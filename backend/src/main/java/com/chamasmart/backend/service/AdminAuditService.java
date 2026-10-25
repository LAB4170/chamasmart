package com.chamasmart.backend.service;

import com.chamasmart.backend.security.ClientIp;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/**
 * The record of everything staff do. Each row carries the hash of the row before it, so removing or changing any row breaks every hash after it.
 * Rows are written in the same transaction as the action they describe, so an action cannot happen without its row. Denied attempts are written separately
 * so they survive the failed request. The database also refuses updates, deletes and truncation.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminAuditService {
    static final long LOCK = 7_001_001L;
    static final String GENESIS = "GENESIS";

    private final JdbcTemplate jdbc;
    private final PlatformTransactionManager tx;

    @Transactional
    public void append(Long adminId, String action, Long chamaId, String detail, String outcome) {
        jdbc.execute("SELECT pg_advisory_xact_lock(" + LOCK + ")");
        List<Map<String, Object>> last = jdbc.queryForList("SELECT seq, row_hash FROM admin_actions WHERE seq IS NOT NULL ORDER BY seq DESC LIMIT 1");
        long seq = last.isEmpty() ? 1 : ((Number) last.get(0).get("seq")).longValue() + 1;
        String prev = last.isEmpty() ? GENESIS : (String) last.get(0).get("row_hash");
        Instant now = Instant.now();
        long micros = now.getEpochSecond() * 1_000_000L + now.getNano() / 1000;
        String d = detail == null ? null : (detail.length() > 600 ? detail.substring(0, 600) : detail);
        String roles = rolesOf(adminId);
        String ip = ClientIp.current();
        String hash = hash(seq, adminId, action, chamaId, d, micros, outcome, roles, ip, prev);
        jdbc.update("INSERT INTO admin_actions (admin_id, action, chama_id, detail, ip_address, seq, at_micros, outcome, roles, prev_hash, row_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                adminId, action, chamaId, d, ip, seq, micros, outcome, roles, prev, hash);
    }

    /** For denied attempts: commits even though the request that caused it is about to fail. */
    public void appendIsolated(Long adminId, String action, Long chamaId, String detail, String outcome) {
        TransactionTemplate t = new TransactionTemplate(tx);
        t.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        t.executeWithoutResult(s -> append(adminId, action, chamaId, detail, outcome));
    }

    String rolesOf(Long userId) {
        if (userId == null) return null;
        try {
            return String.join(",", jdbc.queryForList("SELECT role_code FROM staff_assignments WHERE user_id = ? ORDER BY role_code", String.class, userId));
        } catch (Exception e) { return null; }
    }

    static String hash(long seq, Long admin, String action, Long chama, String detail, long micros, String outcome, String roles, String ip, String prev) {
        String s = String.join("\u001f", String.valueOf(seq), n(admin), n(action), n(chama), n(detail), String.valueOf(micros), n(outcome), n(roles), n(ip), prev);
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }

    private static String n(Object o) { return o == null ? "" : o.toString(); }

    /** Recomputes every hash from the first chained row. */
    public Map<String, Object> verify() {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT seq, admin_id, action, chama_id, detail, ip_address, at_micros, outcome, roles, prev_hash, row_hash FROM admin_actions WHERE seq IS NOT NULL ORDER BY seq");
        String prev = GENESIS; long expected = 1;
        Map<String, Object> out = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            long seq = ((Number) r.get("seq")).longValue();
            String why = null;
            if (seq != expected) why = "a row is missing before this one";
            else if (!prev.equals(r.get("prev_hash"))) why = "this row does not follow the one before it";
            else {
                String h = hash(seq, (Long) (r.get("admin_id") == null ? null : ((Number) r.get("admin_id")).longValue()), (String) r.get("action"),
                        r.get("chama_id") == null ? null : ((Number) r.get("chama_id")).longValue(), (String) r.get("detail"),
                        ((Number) r.get("at_micros")).longValue(), (String) r.get("outcome"), (String) r.get("roles"), (String) r.get("ip_address"), prev);
                if (!h.equals(r.get("row_hash"))) why = "this row was changed after it was written";
            }
            if (why != null) { out.put("ok", false); out.put("checked", seq - 1); out.put("first_break_seq", seq); out.put("reason", why); return out; }
            prev = (String) r.get("row_hash"); expected++;
        }
        out.put("ok", true); out.put("checked", rows.size());
        return out;
    }

    public List<Map<String, Object>> recent(int limit, String action, Long adminId, Long chamaId, String outcome) {
        StringBuilder q = new StringBuilder("SELECT a.seq, a.action_id, a.admin_id, u.first_name, u.last_name, a.roles, a.action, a.outcome, a.chama_id, a.detail, a.ip_address, a.at FROM admin_actions a LEFT JOIN users u ON u.user_id = a.admin_id WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (action != null && !action.isBlank()) { q.append(" AND a.action ILIKE ?"); args.add("%" + action.trim() + "%"); }
        if (adminId != null) { q.append(" AND a.admin_id = ?"); args.add(adminId); }
        if (chamaId != null) { q.append(" AND a.chama_id = ?"); args.add(chamaId); }
        if (outcome != null && !outcome.isBlank()) { q.append(" AND a.outcome = ?"); args.add(outcome.toUpperCase()); }
        q.append(" ORDER BY a.action_id DESC LIMIT ?"); args.add(Math.min(Math.max(limit, 1), 500));
        return jdbc.queryForList(q.toString(), args.toArray());
    }

    @Scheduled(cron = "${app.audit.verify-cron:0 30 2 * * *}")
    public void nightlyCheck() {
        try {
            Map<String, Object> r = verify();
            boolean ok = Boolean.TRUE.equals(r.get("ok"));
            jdbc.update("INSERT INTO platform_settings (setting_key, setting_value) VALUES ('audit_chain_last', ?) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now()",
                    (ok ? "OK " : "BROKEN ") + Instant.now());
            append(null, ok ? "AUDIT_CHAIN_OK" : "AUDIT_CHAIN_BROKEN", null, r.toString(), ok ? "ALLOWED" : "ALERT");
            if (!ok) log.error("ADMIN AUDIT CHAIN BROKEN: {}", r);
        } catch (Exception e) { log.error("Audit chain check failed", e); }
    }
}
