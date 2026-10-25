package com.chamasmart.backend.service;

import com.chamasmart.backend.mail.OutboundMail;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.YearMonth;
import java.util.*;

/**
 * Anchors the activity log outside the database. Once a month (and on demand) the head of the hash chain is recorded and emailed to
 * every active super admin. A later check compares the log against every recorded fingerprint, so rewriting history is caught even by
 * someone with full database access, as long as the emailed copies are kept.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditFingerprintService {
    private final JdbcTemplate jdbc;
    private final AdminAuditService trail;
    private final OutboundMail mail;

    public List<Map<String, Object>> list() {
        return jdbc.queryForList("SELECT fingerprint_id, label, head_seq, head_hash, entries, chain_ok, emailed_to, created_at FROM audit_fingerprints ORDER BY fingerprint_id DESC LIMIT 120");
    }

    /** Records and emails a fingerprint. {@code actor} is null for the scheduled run. */
    public Map<String, Object> record(Long actor, String label) {
        Map<String, Object> chain = trail.verify();
        var head = jdbc.queryForList("SELECT seq, row_hash FROM admin_actions WHERE seq IS NOT NULL ORDER BY seq DESC LIMIT 1");
        if (head.isEmpty()) throw new IllegalStateException("There is nothing in the activity log yet");
        long seq = ((Number) head.get(0).get("seq")).longValue();
        String hash = (String) head.get(0).get("row_hash");
        boolean ok = Boolean.TRUE.equals(chain.get("ok"));
        long entries = ok ? ((Number) chain.get("checked")).longValue() : seq;
        List<String> to = jdbc.queryForList("""
                SELECT DISTINCT u.email FROM staff_assignments a JOIN staff_accounts s ON s.user_id = a.user_id AND s.status = 'ACTIVE'
                JOIN users u ON u.user_id = a.user_id WHERE a.role_code = 'SUPER_ADMIN' AND u.email IS NOT NULL""", String.class);
        String subject = "ChamaSmart activity log fingerprint " + label;
        String body = "<p>Activity log fingerprint, " + label + ".</p><p>Last entry: <b>" + seq + "</b><br>Entries checked: <b>" + entries + "</b><br>Chain intact when recorded: <b>" + (ok ? "yes" : "NO") + "</b><br>Hash: <code>" + hash + "</code></p>"
                + "<p>Keep this email. If anyone ever doubts the activity log, the hash of entry " + seq + " must still be the one above.</p>" + (ok ? "" : "<p><b>The chain was already broken when this was recorded. Investigate now.</b></p>");
        int sent = 0;
        for (String e : to) if (mail.send(e, subject, body)) sent++;
        long id = jdbc.queryForObject("INSERT INTO audit_fingerprints (label, head_seq, head_hash, entries, chain_ok, emailed_to, created_by) VALUES (?,?,?,?,?,?,?) RETURNING fingerprint_id",
                Long.class, label, seq, hash, entries, ok, sent, actor);
        trail.append(actor, ok ? "FINGERPRINT_RECORDED" : "FINGERPRINT_CHAIN_BROKEN", null, "fingerprint " + id + " at entry " + seq + ", emailed to " + sent + " of " + to.size(), ok ? "ALLOWED" : "ALERT");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("fingerprint_id", id); out.put("head_seq", seq); out.put("head_hash", hash); out.put("chain_ok", ok); out.put("emailed_to", sent); out.put("super_admins", to.size());
        return out;
    }

    /** Compares every recorded fingerprint with the log as it is now. Empty means they all still match. */
    public List<Map<String, Object>> mismatches() {
        List<Map<String, Object>> bad = new ArrayList<>();
        for (var f : jdbc.queryForList("SELECT fingerprint_id, head_seq, head_hash, created_at FROM audit_fingerprints ORDER BY fingerprint_id")) {
            var cur = jdbc.queryForList("SELECT row_hash FROM admin_actions WHERE seq = ?", f.get("head_seq"));
            if (cur.isEmpty() || !f.get("head_hash").equals(cur.get(0).get("row_hash"))) {
                Map<String, Object> m = new LinkedHashMap<>(f);
                m.put("problem", cur.isEmpty() ? "that entry no longer exists" : "that entry now has a different hash");
                bad.add(m);
            }
        }
        return bad;
    }

    /** The chain check plus the comparison with recorded fingerprints. */
    public Map<String, Object> verifyAll() {
        Map<String, Object> r = new LinkedHashMap<>(trail.verify());
        var bad = mismatches();
        r.put("fingerprints_checked", jdbc.queryForObject("SELECT count(*) FROM audit_fingerprints", Long.class));
        if (!bad.isEmpty()) { r.put("ok", false); r.put("fingerprint_mismatches", bad); r.putIfAbsent("reason", "the log no longer matches a recorded fingerprint"); }
        return r;
    }

    @Scheduled(cron = "${app.audit.fingerprint-cron:0 0 3 1 * *}")
    public void monthly() {
        try { record(null, YearMonth.now().toString()); } catch (Exception e) { log.error("Monthly fingerprint failed", e); }
    }

    @Scheduled(cron = "${app.audit.anchor-cron:0 45 2 * * *}")
    @Transactional
    public void nightlyAnchorCheck() {
        try {
            var bad = mismatches();
            if (!bad.isEmpty()) {
                log.error("ACTIVITY LOG DOES NOT MATCH RECORDED FINGERPRINTS: {}", bad);
                trail.append(null, "FINGERPRINT_MISMATCH", null, bad.toString(), "ALERT");
            }
        } catch (Exception e) { log.error("Anchor check failed", e); }
    }
}
