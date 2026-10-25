package com.chamasmart.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.*;

/**
 * Registration and identity documents. Files are checked by their contents (PDF, JPEG or PNG only), encrypted with AES-256-GCM before storage, and bound to
 * their record so a ciphertext cannot be moved to another document. Chama officials can upload and list but never download. Staff with the right permission
 * can open a file, and every opening is written to the admin trail first.
 */
@Service
@RequiredArgsConstructor
public class DocumentService {
    public static final Set<String> TYPES = new LinkedHashSet<>(List.of("REGISTRATION_CERTIFICATE", "CONSTITUTION", "OFFICIALS_RESOLUTION", "PAYBILL_PROOF", "OFFICIAL_ID"));
    static final Map<String, String> LABELS = Map.of(
            "REGISTRATION_CERTIFICATE", "Registration certificate", "CONSTITUTION", "Constitution", "OFFICIALS_RESOLUTION", "Officials' resolution",
            "PAYBILL_PROOF", "Proof the chama owns its paybill, till or bank account", "OFFICIAL_ID", "National ID of an official");
    static final long MAX_BYTES = 5L * 1024 * 1024;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final JdbcTemplate jdbc;
    private final MembershipService membership;
    private final AdminGuard audit;

    @Value("${app.documents.key:}") String documentKey = "";
    @Value("${app.security.data-key:}") String dataKey = "";
    @Value("${app.documents.retention-years:7}") int retentionYears = 7;

    // ---------- chama side ----------

    @Transactional
    public Map<String, Object> upload(Long chamaId, Long userId, String type, Long subjectUserId, MultipartFile file) {
        var me = membership.activeOfficial(chamaId, userId);
        byte[] key = key();
        if (type == null || !TYPES.contains(type)) throw new IllegalArgumentException("Choose what kind of document this is");
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Choose a file");
        if (file.getSize() > MAX_BYTES) throw new IllegalArgumentException("Files can be at most 5 MB");
        Long subject = null;
        if ("OFFICIAL_ID".equals(type)) {
            subject = subjectUserId == null ? userId : subjectUserId;
            Integer isOfficial = jdbc.queryForObject("SELECT count(*) FROM chama_members WHERE chama_id = ? AND user_id = ? AND is_active = true AND upper(role) IN ('CHAIRPERSON','TREASURER','SECRETARY')", Integer.class, chamaId, subject);
            if (isOfficial == null || isOfficial == 0) throw new IllegalArgumentException("An ID can only be uploaded for the chairperson, treasurer or secretary");
            if (!subject.equals(userId) && !"CHAIRPERSON".equalsIgnoreCase(me.getRole())) throw new AccessDeniedException("Upload your own ID. The chairperson can upload for others");
        }
        Integer recent = jdbc.queryForObject("SELECT count(*) FROM chama_documents WHERE uploaded_by = ? AND uploaded_at > now() - interval '1 day'", Integer.class, userId);
        if (recent != null && recent >= 20) throw new IllegalStateException("Too many uploads today. Try again tomorrow");
        Integer active = jdbc.queryForObject("SELECT count(*) FROM chama_documents WHERE chama_id = ? AND status = 'ACTIVE'", Integer.class, chamaId);
        if (active != null && active >= 30) throw new IllegalStateException("This chama has reached the limit of stored documents");
        byte[] data;
        try { data = file.getBytes(); } catch (Exception e) { throw new IllegalStateException("Could not read the file"); }
        String ct = sniff(data);
        if (ct == null) throw new IllegalArgumentException("Only PDF, JPEG or PNG files are accepted");
        String sha = hex(sha256(data));
        jdbc.update("UPDATE chama_documents SET status = 'SUPERSEDED' WHERE chama_id = ? AND doc_type = ? AND status = 'ACTIVE' AND subject_user_id IS NOT DISTINCT FROM ?", chamaId, type, subject);
        Long id = jdbc.queryForObject("""
                INSERT INTO chama_documents (chama_id, doc_type, subject_user_id, original_name, content_type, size_bytes, sha256, uploaded_by, retention_until)
                VALUES (?,?,?,?,?,?,?,?, now() + (? * interval '1 year')) RETURNING doc_id""",
                Long.class, chamaId, type, subject, cleanName(file.getOriginalFilename()), ct, (long) data.length, sha, userId, retentionYears);
        byte[] iv = new byte[12]; RANDOM.nextBytes(iv);
        jdbc.update("INSERT INTO document_blobs (doc_id, key_id, iv, ciphertext) VALUES (?,1,?,?)", id, iv, crypt(Cipher.ENCRYPT_MODE, key, iv, data, aad(id, chamaId, sha)));
        return Map.of("doc_id", id, "doc_type", type, "content_type", ct, "size_bytes", data.length);
    }

    public List<Map<String, Object>> listForChama(Long chamaId, Long userId) {
        membership.activeOfficial(chamaId, userId);
        return jdbc.queryForList("SELECT doc_id, doc_type, subject_user_id, original_name, size_bytes, status, uploaded_at FROM chama_documents WHERE chama_id = ? AND status IN ('ACTIVE','SUPERSEDED') ORDER BY uploaded_at DESC", chamaId);
    }

    /** What is still missing for an application: one of each document, plus an ID for each of the three officials. */
    public List<String> missing(Long chamaId) {
        List<String> out = new ArrayList<>();
        for (String t : TYPES) {
            if ("OFFICIAL_ID".equals(t)) continue;
            Integer n = jdbc.queryForObject("SELECT count(*) FROM chama_documents WHERE chama_id = ? AND doc_type = ? AND status = 'ACTIVE'", Integer.class, chamaId, t);
            if (n == null || n == 0) out.add(LABELS.get(t));
        }
        List<Long> officials = jdbc.queryForList("SELECT user_id FROM chama_members WHERE chama_id = ? AND is_active = true AND upper(role) IN ('CHAIRPERSON','TREASURER','SECRETARY')", Long.class, chamaId);
        for (Long o : officials) {
            Integer n = jdbc.queryForObject("SELECT count(*) FROM chama_documents WHERE chama_id = ? AND doc_type = 'OFFICIAL_ID' AND subject_user_id = ? AND status = 'ACTIVE'", Integer.class, chamaId, o);
            if (n == null || n == 0) out.add("National ID of " + jdbc.queryForObject("SELECT first_name || ' ' || last_name FROM users WHERE user_id = ?", String.class, o));
        }
        return out;
    }

    // ---------- staff side ----------

    public List<Map<String, Object>> staffList(Long chamaId) {
        return jdbc.queryForList("""
                SELECT d.doc_id, d.doc_type, d.subject_user_id, d.original_name, d.content_type, d.size_bytes, d.sha256, d.status, d.uploaded_at, d.retention_until,
                       d.legal_hold, d.hold_reason, d.deleted_at, u.first_name || ' ' || u.last_name AS uploaded_by_name
                FROM chama_documents d JOIN users u ON u.user_id = d.uploaded_by WHERE d.chama_id = ? ORDER BY d.uploaded_at DESC""", chamaId);
    }

    public record Opened(String name, String contentType, byte[] bytes) {}

    /** Opens a file for staff. The opening is recorded first, in the same transaction, so a file cannot be read without a row saying who read it. */
    @Transactional
    public Opened open(Long staffId, Long docId) {
        var m = jdbc.queryForList("SELECT chama_id, original_name, content_type, sha256, status FROM chama_documents WHERE doc_id = ?", docId);
        if (m.isEmpty()) throw new IllegalArgumentException("Document not found");
        Map<String, Object> d = m.get(0);
        if ("DELETED".equals(d.get("status"))) throw new IllegalStateException("This document was deleted");
        Long chamaId = ((Number) d.get("chama_id")).longValue();
        audit.log(staffId, "DOCUMENT_OPENED", chamaId, "document " + docId);
        var b = jdbc.queryForList("SELECT iv, ciphertext FROM document_blobs WHERE doc_id = ?", docId);
        if (b.isEmpty()) throw new IllegalStateException("The file contents are not available");
        String sha = (String) d.get("sha256");
        byte[] plain = crypt(Cipher.DECRYPT_MODE, key(), (byte[]) b.get(0).get("iv"), (byte[]) b.get(0).get("ciphertext"), aad(docId, chamaId, sha));
        if (!hex(sha256(plain)).equals(sha)) throw new IllegalStateException("The stored file failed its integrity check");
        return new Opened((String) d.get("original_name"), (String) d.get("content_type"), plain);
    }

    @Transactional
    public Map<String, Object> hold(Long actorId, Long docId, boolean on, String reason) {
        if (reason == null || reason.trim().length() < 5) throw new IllegalArgumentException("Say why");
        var m = jdbc.queryForList("SELECT chama_id, status FROM chama_documents WHERE doc_id = ? FOR UPDATE", docId);
        if (m.isEmpty()) throw new IllegalArgumentException("Document not found");
        if ("DELETED".equals(m.get(0).get("status"))) throw new IllegalStateException("This document was already deleted");
        jdbc.update("UPDATE chama_documents SET legal_hold = ?, hold_reason = ?, hold_by = ?, hold_at = now() WHERE doc_id = ?", on, reason.trim(), actorId, docId);
        audit.log(actorId, on ? "LEGAL_HOLD_ON" : "LEGAL_HOLD_OFF", ((Number) m.get(0).get("chama_id")).longValue(), "document " + docId + ": " + reason.trim());
        return Map.of("doc_id", docId, "legal_hold", on);
    }

    /** Holds every stored document of a chama. Used by legal staff and automatically when a serious notice takes effect. */
    @Transactional
    public int holdAll(Long actorId, Long chamaId, String reason) {
        int n = jdbc.update("UPDATE chama_documents SET legal_hold = true, hold_reason = ?, hold_by = ?, hold_at = now() WHERE chama_id = ? AND status <> 'DELETED' AND legal_hold = false", reason, actorId, chamaId);
        audit.log(actorId, "LEGAL_HOLD_ALL", chamaId, n + " documents: " + reason);
        return n;
    }

    @Transactional
    public Map<String, Object> delete(Long actorId, Long docId, String reason) {
        if (reason == null || reason.trim().length() < 10) throw new IllegalArgumentException("Write down why this is being deleted");
        var m = jdbc.queryForList("SELECT chama_id, status, legal_hold, retention_until > now() AS retained FROM chama_documents WHERE doc_id = ? FOR UPDATE", docId);
        if (m.isEmpty()) throw new IllegalArgumentException("Document not found");
        Map<String, Object> d = m.get(0);
        if ("DELETED".equals(d.get("status"))) throw new IllegalStateException("Already deleted");
        if (Boolean.TRUE.equals(d.get("legal_hold"))) throw new IllegalStateException("This document is under a legal hold. Release the hold first");
        if (Boolean.TRUE.equals(d.get("retained"))) throw new IllegalStateException("This document must be kept until its retention period ends");
        jdbc.update("DELETE FROM document_blobs WHERE doc_id = ?", docId);
        jdbc.update("UPDATE chama_documents SET status = 'DELETED', deleted_at = now(), deleted_by = ?, delete_reason = ? WHERE doc_id = ?", actorId, reason.trim(), docId);
        audit.log(actorId, "DOCUMENT_DELETED", ((Number) d.get("chama_id")).longValue(), "document " + docId + ": " + reason.trim());
        return Map.of("doc_id", docId, "status", "DELETED");
    }

    // ---------- crypto ----------

    byte[] key() {
        try {
            if (documentKey != null && !documentKey.isBlank()) {
                byte[] raw = Base64.getDecoder().decode(documentKey.trim());
                if (raw.length != 32) throw new IllegalStateException("DOCUMENT_ENCRYPTION_KEY must be 32 bytes, base64 encoded");
                return raw;
            }
            if (dataKey != null && !dataKey.isBlank()) return sha256((dataKey.trim() + "|documents").getBytes(StandardCharsets.UTF_8));
        } catch (IllegalArgumentException e) { throw new IllegalStateException("The document encryption key is not valid base64"); }
        throw new IllegalStateException("Document storage is not switched on: set DOCUMENT_ENCRYPTION_KEY on the server");
    }

    static byte[] crypt(int mode, byte[] key, byte[] iv, byte[] in, byte[] aad) {
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(mode, new SecretKeySpec(key, "AES"), new GCMParameterSpec(128, iv));
            c.updateAAD(aad);
            return c.doFinal(in);
        } catch (Exception e) { throw new IllegalStateException("The file could not be " + (mode == Cipher.ENCRYPT_MODE ? "protected" : "unlocked. The key may have changed or the data was altered"), e); }
    }

    static byte[] aad(Long docId, Long chamaId, String sha) { return ("doc:" + docId + "|chama:" + chamaId + "|" + sha).getBytes(StandardCharsets.UTF_8); }

    static String sniff(byte[] b) {
        if (b.length >= 5 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F' && b[4] == '-') return "application/pdf";
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "image/jpeg";
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G' && b[4] == 0x0D && b[5] == 0x0A && b[6] == 0x1A && b[7] == 0x0A) return "image/png";
        return null;
    }

    static String cleanName(String n) {
        if (n == null) return "document";
        String base = n.replace('\\', '/'); base = base.substring(base.lastIndexOf('/') + 1).replaceAll("[^A-Za-z0-9._ -]", "_").trim();
        if (base.isEmpty()) base = "document";
        return base.length() > 100 ? base.substring(base.length() - 100) : base;
    }

    static byte[] sha256(byte[] b) { try { return MessageDigest.getInstance("SHA-256").digest(b); } catch (Exception e) { throw new IllegalStateException(e); } }
    static String hex(byte[] d) { StringBuilder sb = new StringBuilder(); for (byte x : d) sb.append(String.format("%02x", x)); return sb.toString(); }
}
