package com.chamasmart.backend.config;

import com.chamasmart.backend.util.FieldCrypto;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * One-time fix for finding S-18. Until now a converter applied to EVERY String column Base64-encoded it in the database.
 * This reads each text column the way the old code did, writes the plain value back, and records that it has done so.
 *
 * Safety:
 * - runs inside one transaction under an advisory lock, so it either completes or changes nothing;
 * - a failure stops the application from starting (the previous deploy keeps serving), because running the new mapping
 *   over Base64 data would show garbage;
 * - every table it changes is first copied to s18_backup_<table>, which can be dropped once the data has been checked;
 * - it is recorded in data_migrations and never runs twice.
 *
 * Runs inside the application's startup, before the web server accepts requests.
 */
@Component
@DependsOn({"entityManagerFactory", "fieldCryptoConfig"})
@Slf4j
public class LegacyBase64Migration {
    static final String NAME = "s18_base64_to_plain";
    private final DataSource dataSource;

    @Value("${app.migrations.s18.enabled:true}")
    private boolean enabled = true;

    public LegacyBase64Migration(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    /** What the old converter showed the application for a stored value. Null means "keep it as it is". */
    public static String decodeLegacy(String stored) {
        if (stored == null || stored.isEmpty()) return null;
        try {
            byte[] raw = Base64.getDecoder().decode(stored);
            String text = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(raw)).toString();
            // Text the old code could not have produced (control characters) means the value was never encoded.
            for (int i = 0; i < text.length(); i++) {
                char ch = text.charAt(i);
                if (ch < 0x20 && ch != '\n' && ch != '\r' && ch != '\t') return null;
            }
            return text;
        } catch (IllegalArgumentException | CharacterCodingException e) {
            return null;
        }
    }

    @PostConstruct
    void run() throws Exception {
        if (!enabled) { log.info("S-18 migration disabled by configuration"); return; }
        try (Connection c = dataSource.getConnection()) {
            c.setAutoCommit(false);
            try {
                migrate(c);
                c.commit();
            } catch (Exception e) {
                c.rollback();
                throw new IllegalStateException("S-18 data migration failed and was rolled back; the application will not start", e);
            }
        }
    }

    void migrate(Connection c) throws Exception {
        try (Statement st = c.createStatement()) {
            st.execute("SELECT pg_advisory_xact_lock(727001)");
            // The encrypted form is longer than the old 50-character column allowed.
            st.execute("ALTER TABLE IF EXISTS users ALTER COLUMN national_id TYPE varchar(255)");
            st.execute("CREATE TABLE IF NOT EXISTS data_migrations (name varchar(100) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now(), note text)");
        }
        try (PreparedStatement ps = c.prepareStatement("SELECT 1 FROM data_migrations WHERE name = ?")) {
            ps.setString(1, NAME);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) { return; }
            }
        }
        Map<String, List<String>> columns = new LinkedHashMap<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(
                "SELECT c.table_name, c.column_name FROM information_schema.columns c " +
                "JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE' " +
                "WHERE c.table_schema = 'public' AND c.data_type IN ('character varying', 'text', 'character') " +
                "AND c.table_name NOT LIKE 's18\\_backup\\_%' AND c.table_name <> 'data_migrations' ORDER BY c.table_name, c.ordinal_position")) {
            while (rs.next()) columns.computeIfAbsent(rs.getString(1), k -> new ArrayList<>()).add(rs.getString(2));
        }
        long rowsChanged = 0;
        int tablesChanged = 0;
        for (Map.Entry<String, List<String>> e : columns.entrySet()) {
            long n = migrateTable(c, e.getKey(), e.getValue());
            if (n > 0) { rowsChanged += n; tablesChanged++; }
        }
        encryptNationalIds(c);
        try (PreparedStatement ps = c.prepareStatement("INSERT INTO data_migrations(name, note) VALUES (?, ?)")) {
            ps.setString(1, NAME);
            ps.setString(2, rowsChanged + " rows in " + tablesChanged + " tables decoded; backups in s18_backup_* tables");
            ps.executeUpdate();
        }
        log.info("S-18 migration complete: {} rows in {} tables decoded. Check the data, then drop the s18_backup_* tables.", rowsChanged, tablesChanged);
    }

    private static String q(String ident) { return "\"" + ident.replace("\"", "\"\"") + "\""; }

    private long migrateTable(Connection c, String table, List<String> cols) throws Exception {
        StringBuilder select = new StringBuilder("SELECT ctid::text");
        for (String col : cols) select.append(", ").append(q(col));
        select.append(" FROM ").append(q(table));
        List<Object[]> updates = new ArrayList<>(); // [ctid, String[] newValues (null = unchanged)]
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery(select.toString())) {
            while (rs.next()) {
                String[] newVals = new String[cols.size()];
                boolean any = false;
                for (int i = 0; i < cols.size(); i++) {
                    String decoded = decodeLegacy(rs.getString(i + 2));
                    if (decoded != null) { newVals[i] = decoded; any = true; }
                }
                if (any) updates.add(new Object[]{rs.getString(1), newVals});
            }
        }
        if (updates.isEmpty()) return 0;
        try (Statement st = c.createStatement()) {
            st.execute("CREATE TABLE IF NOT EXISTS " + q("s18_backup_" + table) + " AS TABLE " + q(table));
        }
        for (Object[] u : updates) {
            String[] vals = (String[]) u[1];
            StringBuilder set = new StringBuilder();
            for (int i = 0; i < cols.size(); i++) {
                if (vals[i] == null) continue;
                if (set.length() > 0) set.append(", ");
                set.append(q(cols.get(i))).append(" = ?");
            }
            try (PreparedStatement ps = c.prepareStatement("UPDATE " + q(table) + " SET " + set + " WHERE ctid = ?::tid")) {
                int idx = 1;
                for (String v : vals) if (v != null) ps.setString(idx++, v);
                ps.setString(idx, (String) u[0]);
                if (ps.executeUpdate() != 1) throw new IllegalStateException("Expected to update exactly one row in " + table);
            }
        }
        log.info("S-18: decoded {} row(s) in {}", updates.size(), table);
        return updates.size();
    }

    /** National IDs move to AES-GCM now that they are plain text, when a key is configured. */
    private void encryptNationalIds(Connection c) throws Exception {
        if (!FieldCrypto.hasKey()) return;
        List<String[]> rows = new ArrayList<>();
        try (Statement st = c.createStatement(); ResultSet rs = st.executeQuery("SELECT user_id::text, national_id FROM users WHERE national_id IS NOT NULL AND national_id <> ''")) {
            while (rs.next()) rows.add(new String[]{rs.getString(1), rs.getString(2)});
        } catch (java.sql.SQLException e) {
            throw e;
        }
        for (String[] r : rows) {
            String enc = FieldCrypto.encrypt(r[1]);
            if (enc.equals(r[1])) continue;
            try (PreparedStatement ps = c.prepareStatement("UPDATE users SET national_id = ? WHERE user_id = ?::bigint")) {
                ps.setString(1, enc);
                ps.setString(2, r[0]);
                ps.executeUpdate();
            }
        }
    }
}
