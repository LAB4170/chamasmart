package com.chamasmart.backend.service;

import com.chamasmart.backend.security.ClientIp;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

/**
 * The documents chama officials must accept before a chama can be listed publicly.
 * A version can only be accepted once an administrator has published it, and publishing requires the name of the lawyer who reviewed it.
 * Each acceptance stores a fingerprint of the exact text agreed to, and cannot be changed afterwards.
 */
@Service
@RequiredArgsConstructor
public class AgreementService {
    public static final List<String> REQUIRED = List.of("TERMS_OF_USE", "OPERATOR_AGREEMENT", "FRAUD_POLICY");

    private final JdbcTemplate jdbc;
    private final MembershipService membership;
    private final AdminGuard audit;

    public static String hash(String text) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }

    @Transactional
    public Map<String, Object> createDraft(Long adminId, String code, String version, String title, String body) {
        if (!REQUIRED.contains(code)) throw new IllegalArgumentException("Unknown agreement. Use one of " + REQUIRED);
        if (version == null || version.isBlank() || title == null || title.isBlank() || body == null || body.length() < 50) throw new IllegalArgumentException("Give a version, a title and the full text");
        Long id = jdbc.queryForObject("INSERT INTO agreement_versions (code, version, title, body, body_hash) VALUES (?,?,?,?,?) RETURNING agreement_id",
                Long.class, code, version.trim(), title.trim(), body, hash(body));
        audit.log(adminId, "AGREEMENT_DRAFTED", null, code + " " + version);
        return Map.of("agreement_id", id, "status", "DRAFT");
    }

    @Transactional
    public Map<String, Object> publish(Long adminId, Long agreementId, String counsel) {
        if (counsel == null || counsel.trim().length() < 3) throw new IllegalArgumentException("Name the lawyer or firm that reviewed this text before publishing");
        var row = jdbc.queryForList("SELECT code, status FROM agreement_versions WHERE agreement_id = ? FOR UPDATE", agreementId);
        if (row.isEmpty()) throw new IllegalArgumentException("Agreement not found");
        if (!"DRAFT".equals(row.get(0).get("status"))) throw new IllegalStateException("Only a draft can be published");
        String code = (String) row.get(0).get("code");
        jdbc.update("UPDATE agreement_versions SET status = 'SUPERSEDED' WHERE code = ? AND status = 'PUBLISHED'", code);
        jdbc.update("UPDATE agreement_versions SET status = 'PUBLISHED', reviewed_by_counsel = ?, published_by = ?, published_at = now() WHERE agreement_id = ?", counsel.trim(), adminId, agreementId);
        audit.log(adminId, "AGREEMENT_PUBLISHED", null, code + " #" + agreementId + " reviewed by " + counsel.trim());
        return Map.of("agreement_id", agreementId, "status", "PUBLISHED");
    }

    public List<Map<String, Object>> all() {
        return jdbc.queryForList("SELECT agreement_id, code, version, title, status, reviewed_by_counsel, published_at, created_at FROM agreement_versions ORDER BY code, created_at DESC");
    }

    public Map<String, Object> get(Long id) {
        var r = jdbc.queryForList("SELECT agreement_id, code, version, title, body, body_hash, status, published_at FROM agreement_versions WHERE agreement_id = ?", id);
        if (r.isEmpty()) throw new IllegalArgumentException("Agreement not found");
        return r.get(0);
    }

    /** The currently published text of each required agreement. */
    public List<Map<String, Object>> published() {
        return jdbc.queryForList("SELECT agreement_id, code, version, title, body, body_hash, published_at FROM agreement_versions WHERE status = 'PUBLISHED' ORDER BY code");
    }

    @Transactional
    public Map<String, Object> accept(Long chamaId, Long userId, Long agreementId) {
        membership.activeOfficial(chamaId, userId);
        var r = jdbc.queryForList("SELECT body_hash, status FROM agreement_versions WHERE agreement_id = ?", agreementId);
        if (r.isEmpty()) throw new IllegalArgumentException("Agreement not found");
        if (!"PUBLISHED".equals(r.get(0).get("status"))) throw new IllegalStateException("This version is not in force. Reload and read the current one");
        jdbc.update("INSERT INTO agreement_acceptances (agreement_id, user_id, chama_id, body_hash, ip_address, user_agent) VALUES (?,?,?,?,?,?) ON CONFLICT DO NOTHING",
                agreementId, userId, chamaId, r.get(0).get("body_hash"), ClientIp.current(), ClientIp.currentUserAgent());
        return Map.of("accepted", true);
    }

    /** For one chama: each required agreement, whether a version is published, and which active officials have accepted it. */
    public List<Map<String, Object>> status(Long chamaId) {
        List<Long> officials = officialIds(chamaId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> a : published()) {
            Long id = ((Number) a.get("agreement_id")).longValue();
            List<Long> done = jdbc.queryForList("SELECT user_id FROM agreement_acceptances WHERE agreement_id = ? AND chama_id = ?", Long.class, id, chamaId);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("agreement_id", id); m.put("code", a.get("code")); m.put("version", a.get("version")); m.put("title", a.get("title"));
            m.put("accepted_by", done.stream().filter(officials::contains).toList());
            m.put("missing", officials.stream().filter(o -> !done.contains(o)).toList());
            out.add(m);
        }
        return out;
    }

    /** True when every required agreement has a published version and every active official has accepted it. Needs at least three officials. */
    public boolean allAccepted(Long chamaId) {
        List<Long> officials = officialIds(chamaId);
        if (officials.size() < 3) return false;
        var st = status(chamaId);
        Set<String> have = new HashSet<>();
        for (var s : st) { have.add((String) s.get("code")); if (!((List<?>) s.get("missing")).isEmpty()) return false; }
        return have.containsAll(REQUIRED);
    }

    List<Long> officialIds(Long chamaId) {
        return jdbc.queryForList("SELECT user_id FROM chama_members WHERE chama_id = ? AND is_active = true AND upper(role) IN ('CHAIRPERSON','TREASURER','SECRETARY')", Long.class, chamaId);
    }
}
