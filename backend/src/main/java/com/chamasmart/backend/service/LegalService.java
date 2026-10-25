package com.chamasmart.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Legal desk: the case file for an enforcement case, the register of court orders and requests received, and the referral pack.
 * Notes, evidence links, order history and disclosures are append-only, in the database as well as here.
 */
@Service
@RequiredArgsConstructor
public class LegalService {
    private static final Set<String> KINDS = Set.of("COURT_ORDER", "PRESERVATION", "DISCLOSURE_REQUEST", "POLICE_REQUEST", "REGULATOR_REQUEST", "OTHER");
    private static final Set<String> STATUSES = Set.of("RECEIVED", "UNDER_REVIEW", "COMPLIED", "CONTESTED", "CLOSED");

    private final JdbcTemplate jdbc;
    private final AdminGuard guard;
    private final DocumentService documents;
    private final AdminAuditService trail;

    // ---------- case file ----------

    public Map<String, Object> caseFile(Long caseId) {
        var c = jdbc.queryForList("SELECT * FROM enforcement_cases WHERE case_id = ?", caseId);
        if (c.isEmpty()) throw new IllegalArgumentException("Case not found");
        Long chamaId = ((Number) c.get(0).get("chama_id")).longValue();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("case", c.get(0));
        m.put("chama", jdbc.queryForList("SELECT chama_id, chama_name, currency, created_at FROM chamas WHERE chama_id = ?", chamaId).stream().findFirst().orElse(Map.of()));
        m.put("officials", officials(chamaId));
        m.put("notes", jdbc.queryForList("SELECT n.note_id, n.body, n.created_at, u.first_name || ' ' || u.last_name AS author FROM case_notes n JOIN users u ON u.user_id = n.author_id WHERE n.case_id = ? ORDER BY n.note_id", caseId));
        m.put("documents", jdbc.queryForList("SELECT doc_id, doc_type, original_name, subject_user_id FROM chama_documents WHERE chama_id = ? AND status = 'ACTIVE' ORDER BY doc_id DESC", chamaId));
        m.put("evidence", jdbc.queryForList("""
                SELECT e.evidence_id, e.doc_id, e.note, e.added_at, d.doc_type, d.original_name, d.sha256, d.status, d.legal_hold
                FROM case_evidence e JOIN chama_documents d ON d.doc_id = e.doc_id WHERE e.case_id = ? ORDER BY e.evidence_id""", caseId));
        m.put("orders", jdbc.queryForList("SELECT order_id, reference, kind, issuing_body, due_on, status FROM legal_orders WHERE case_id = ? OR chama_id = ? ORDER BY order_id DESC", caseId, chamaId));
        m.put("acceptances", acceptances(chamaId));
        m.put("trail", jdbc.queryForList("SELECT seq, action, outcome, detail, at FROM admin_actions WHERE chama_id = ? ORDER BY action_id DESC LIMIT 200", chamaId));
        m.put("disclosures", jdbc.queryForList("SELECT disclosure_id, recipient, basis, order_id, included_documents, generated_at FROM legal_disclosures WHERE case_id = ? ORDER BY disclosure_id DESC", caseId));
        return m;
    }

    @Transactional
    public Map<String, Object> addNote(Long actor, Long caseId, String body) {
        if (body == null || body.trim().length() < 10) throw new IllegalArgumentException("Write the note (at least 10 characters)");
        Long chamaId = caseChama(caseId);
        jdbc.update("INSERT INTO case_notes (case_id, author_id, body) VALUES (?,?,?)", caseId, actor, trunc(body, 2000));
        guard.log(actor, "CASE_NOTE_ADDED", chamaId, "case " + caseId);
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> attachEvidence(Long actor, Long caseId, Long docId, String note) {
        Long chamaId = caseChama(caseId);
        var d = jdbc.queryForList("SELECT chama_id, status FROM chama_documents WHERE doc_id = ?", docId);
        if (d.isEmpty() || !chamaId.equals(((Number) d.get(0).get("chama_id")).longValue())) throw new IllegalArgumentException("That document does not belong to this chama");
        if ("DELETED".equals(d.get(0).get("status"))) throw new IllegalStateException("That document was deleted");
        try {
            jdbc.update("INSERT INTO case_evidence (case_id, doc_id, note, added_by) VALUES (?,?,?,?)", caseId, docId, note == null ? null : trunc(note, 500), actor);
        } catch (org.springframework.dao.DuplicateKeyException e) { throw new IllegalStateException("That document is already attached to this case"); }
        Boolean held = jdbc.queryForObject("SELECT legal_hold FROM chama_documents WHERE doc_id = ?", Boolean.class, docId);
        if (!Boolean.TRUE.equals(held)) documents.hold(actor, docId, true, "Evidence in case " + caseId);
        guard.log(actor, "CASE_EVIDENCE_ADDED", chamaId, "case " + caseId + " document " + docId);
        return Map.of("ok", true);
    }

    // ---------- register of orders ----------

    public List<Map<String, Object>> orders(String status) {
        String base = """
                SELECT o.*, c.chama_name, (o.due_on IS NOT NULL AND o.due_on < current_date AND o.status IN ('RECEIVED','UNDER_REVIEW','CONTESTED')) AS overdue
                FROM legal_orders o LEFT JOIN chamas c ON c.chama_id = o.chama_id""";
        return status == null || status.isBlank()
                ? jdbc.queryForList(base + " ORDER BY overdue DESC, o.due_on NULLS LAST, o.order_id DESC LIMIT 500")
                : jdbc.queryForList(base + " WHERE o.status = ? ORDER BY o.due_on NULLS LAST, o.order_id DESC LIMIT 500", status.toUpperCase());
    }

    public Map<String, Object> order(Long id) {
        var o = orders(null).stream().filter(x -> ((Number) x.get("order_id")).longValue() == id).findFirst().orElseThrow(() -> new IllegalArgumentException("Order not found"));
        Map<String, Object> m = new LinkedHashMap<>(o);
        m.put("history", jdbc.queryForList("SELECT e.status_to, e.note, e.at, u.first_name || ' ' || u.last_name AS actor FROM legal_order_events e JOIN users u ON u.user_id = e.actor_id WHERE e.order_id = ? ORDER BY e.event_id", id));
        return m;
    }

    @Transactional
    public Map<String, Object> registerOrder(Long actor, Map<String, Object> b) {
        String kind = str(b, "kind"), ref = str(b, "reference"), body = str(b, "issuing_body"), summary = str(b, "summary");
        if (kind == null || !KINDS.contains(kind.toUpperCase())) throw new IllegalArgumentException("Choose what kind of order or request this is");
        if (ref == null || ref.isBlank() || body == null || body.isBlank()) throw new IllegalArgumentException("Enter the reference and who issued it");
        if (summary == null || summary.trim().length() < 10) throw new IllegalArgumentException("Summarise what it asks for (at least 10 characters)");
        LocalDate received = date(b, "received_on", LocalDate.now()), due = date(b, "due_on", null);
        Long chamaId = lng(b, "chama_id"), caseId = lng(b, "case_id");
        if (chamaId != null && jdbc.queryForObject("SELECT count(*) FROM chamas WHERE chama_id = ?", Integer.class, chamaId) == 0) throw new IllegalArgumentException("Chama not found");
        if (caseId != null) { Long cc = caseChama(caseId); if (chamaId == null) chamaId = cc; }
        long id = jdbc.queryForObject("""
                INSERT INTO legal_orders (reference, kind, issuing_body, received_on, due_on, chama_id, case_id, summary, created_by)
                VALUES (?,?,?,?,?,?,?,?,?) RETURNING order_id""", Long.class, trunc(ref.trim(), 120), kind.toUpperCase(), trunc(body.trim(), 160), received, due, chamaId, caseId, trunc(summary.trim(), 1000), actor);
        jdbc.update("INSERT INTO legal_order_events (order_id, actor_id, status_to, note) VALUES (?,?,?,?)", id, actor, "RECEIVED", "Registered");
        guard.log(actor, "ORDER_REGISTERED", chamaId, "order " + id + " " + kind + " " + ref.trim());
        if ("PRESERVATION".equalsIgnoreCase(kind) && chamaId != null) documents.holdAll(actor, chamaId, "Preservation: " + trunc(ref.trim(), 100));
        return order(id);
    }

    @Transactional
    public Map<String, Object> moveOrder(Long actor, Long id, String status, String note) {
        if (status == null || !STATUSES.contains(status.toUpperCase())) throw new IllegalArgumentException("Choose a status");
        if (note == null || note.trim().length() < 10) throw new IllegalArgumentException("Say what happened (at least 10 characters)");
        var o = jdbc.queryForList("SELECT chama_id, status FROM legal_orders WHERE order_id = ? FOR UPDATE", id);
        if (o.isEmpty()) throw new IllegalArgumentException("Order not found");
        if ("CLOSED".equals(o.get(0).get("status"))) throw new IllegalStateException("This order is closed");
        String to = status.toUpperCase();
        jdbc.update("UPDATE legal_orders SET status = ?, updated_at = now() WHERE order_id = ?", to, id);
        jdbc.update("INSERT INTO legal_order_events (order_id, actor_id, status_to, note) VALUES (?,?,?,?)", id, actor, to, trunc(note.trim(), 1000));
        guard.log(actor, "ORDER_" + to, o.get(0).get("chama_id") == null ? null : ((Number) o.get(0).get("chama_id")).longValue(), "order " + id);
        return order(id);
    }

    // ---------- referral pack ----------

    public record Pack(String filename, byte[] bytes) {}

    /**
     * Builds the evidence bundle for a case. The disclosure is recorded before the bytes leave, in the same transaction, with the recipient and
     * the legal basis. Documents are included only when asked, and each one opened is logged as a document opening.
     */
    @Transactional
    public Pack referralPack(Long actor, boolean mayOpenDocuments, Long caseId, String recipient, String basis, Long orderId, boolean includeDocuments) {
        if (recipient == null || recipient.trim().length() < 3) throw new IllegalArgumentException("Say who the pack is for");
        if (basis == null || basis.trim().length() < 20) throw new IllegalArgumentException("State the legal basis for sharing this (at least 20 characters), for example the court order number");
        if (includeDocuments && !mayOpenDocuments) throw new org.springframework.security.access.AccessDeniedException("You do not have access to open documents");
        Long chamaId = caseChama(caseId);
        if (orderId != null && jdbc.queryForObject("SELECT count(*) FROM legal_orders WHERE order_id = ?", Integer.class, orderId) == 0) throw new IllegalArgumentException("Order not found");

        Map<String, byte[]> files = new LinkedHashMap<>();
        var c = jdbc.queryForList("SELECT * FROM enforcement_cases WHERE case_id = ?", caseId).get(0);
        var chama = jdbc.queryForList("SELECT chama_id, chama_name, currency, created_at FROM chamas WHERE chama_id = ?", chamaId).stream().findFirst().orElse(Map.of());
        files.put("01_summary.txt", b("""
                CASE FILE SUMMARY
                Chama: %s (number %s)
                Case number: %s   Level: %s   Status: %s   Urgent: %s
                Opened: %s by staff member %s
                Reason given to the chama:
                %s

                The chama's response (%s):
                %s

                Outcome: %s
                """.formatted(chama.get("chama_name"), chamaId, caseId, c.get("level"), c.get("status"), c.get("urgent"), c.get("opened_at"), c.get("opened_by"), c.get("reason"),
                c.get("responded_at"), c.get("response_text") == null ? "no response recorded" : c.get("response_text"), c.get("resolution_note") == null ? "not decided" : c.get("resolution_note"))));
        files.put("02_officials.csv", b(csv(officials(chamaId), "user_id", "role", "first_name", "last_name", "email", "phone_number")));
        files.put("03_agreement_acceptances.csv", b(csv(acceptances(chamaId), "user_id", "code", "version", "body_hash", "accepted_at", "ip_address", "user_agent")));
        files.put("04_case_notes.csv", b(csv(jdbc.queryForList("SELECT n.created_at, u.first_name || ' ' || u.last_name AS author, n.body FROM case_notes n JOIN users u ON u.user_id = n.author_id WHERE n.case_id = ? ORDER BY n.note_id", caseId), "created_at", "author", "body")));
        files.put("05_activity_trail.csv", b(csv(jdbc.queryForList("SELECT seq, at, admin_id, roles, action, outcome, detail, prev_hash, row_hash FROM admin_actions WHERE chama_id = ? AND seq IS NOT NULL ORDER BY seq", chamaId), "seq", "at", "admin_id", "roles", "action", "outcome", "detail", "prev_hash", "row_hash")));
        files.put("06_contributions_summary.csv", b(csv(jdbc.queryForList("SELECT status, count(*) AS entries, sum(amount) AS total FROM contributions WHERE chama_id = ? AND coalesce(is_deleted,false) = false GROUP BY status", chamaId), "status", "entries", "total")));
        files.put("07_payouts.csv", b(csv(jdbc.queryForList("SELECT payout_id, created_at, purpose, amount, payee_name, payee_phone, status, requested_by, paid_by, paid_at, payment_reference FROM payouts WHERE chama_id = ? ORDER BY payout_id", chamaId), "payout_id", "created_at", "purpose", "amount", "payee_name", "payee_phone", "status", "requested_by", "paid_by", "paid_at", "payment_reference")));
        files.put("08_payment_events.csv", b(csv(jdbc.queryForList("SELECT provider, provider_event_id, event_type, amount, currency, status, note, received_at FROM payment_events WHERE chama_id = ? ORDER BY event_id", chamaId), "provider", "provider_event_id", "event_type", "amount", "currency", "status", "note", "received_at")));
        var docs = jdbc.queryForList("SELECT doc_id, doc_type, subject_user_id, original_name, content_type, size_bytes, sha256, status, uploaded_at FROM chama_documents WHERE chama_id = ? ORDER BY doc_id", chamaId);
        files.put("09_documents_manifest.csv", b(csv(docs, "doc_id", "doc_type", "subject_user_id", "original_name", "content_type", "size_bytes", "sha256", "status", "uploaded_at")));
        if (includeDocuments) {
            for (var d : docs) {
                if ("DELETED".equals(d.get("status"))) continue;
                var o = documents.open(actor, ((Number) d.get("doc_id")).longValue());
                files.put("documents/" + d.get("doc_id") + "_" + safe(o.name()), o.bytes());
            }
        }
        var chain = trail.verify();
        var head = jdbc.queryForList("SELECT seq, row_hash FROM admin_actions WHERE seq IS NOT NULL ORDER BY seq DESC LIMIT 1");
        StringBuilder man = new StringBuilder("ChamaSmart evidence bundle\nGenerated: " + Instant.now() + "\nCase: " + caseId + "\nRecipient: " + recipient.trim() + "\nBasis: " + basis.trim() + "\n");
        man.append("Activity log chain verified at generation: ").append(chain.get("ok")).append(" (").append(chain.get("checked")).append(" entries)\n");
        if (!head.isEmpty()) man.append("Activity log head: entry ").append(head.get(0).get("seq")).append(" hash ").append(head.get(0).get("row_hash")).append('\n');
        man.append("\nSHA-256 of each file:\n");
        for (var e : files.entrySet()) man.append(sha(e.getValue())).append("  ").append(e.getKey()).append('\n');
        String manifest = man.toString();
        files.put("00_MANIFEST.txt", b(manifest));

        jdbc.update("INSERT INTO legal_disclosures (case_id, chama_id, order_id, recipient, basis, included_documents, manifest_sha256, generated_by) VALUES (?,?,?,?,?,?,?,?)",
                caseId, chamaId, orderId, trunc(recipient.trim(), 200), trunc(basis.trim(), 1000), includeDocuments, sha(b(manifest)), actor);
        guard.log(actor, "REFERRAL_PACK", chamaId, "case " + caseId + " to " + trunc(recipient.trim(), 80) + (includeDocuments ? " with documents" : ""));

        try (ByteArrayOutputStream out = new ByteArrayOutputStream(); ZipOutputStream z = new ZipOutputStream(out)) {
            for (var e : files.entrySet()) { z.putNextEntry(new ZipEntry(e.getKey())); z.write(e.getValue()); z.closeEntry(); }
            z.finish();
            return new Pack("chamasmart-case-" + caseId + "-evidence.zip", out.toByteArray());
        } catch (java.io.IOException e) { throw new IllegalStateException("Could not build the pack"); }
    }

    // ---------- helpers ----------

    private List<Map<String, Object>> officials(Long chamaId) {
        return jdbc.queryForList("""
                SELECT m.user_id, m.role, u.first_name, u.last_name, u.email, u.phone_number
                FROM chama_members m JOIN users u ON u.user_id = m.user_id
                WHERE m.chama_id = ? AND upper(m.role) IN ('CHAIRPERSON','TREASURER','SECRETARY') ORDER BY m.role, m.user_id""", chamaId);
    }

    private List<Map<String, Object>> acceptances(Long chamaId) {
        return jdbc.queryForList("""
                SELECT a.user_id, v.code, v.version, a.body_hash, a.accepted_at, a.ip_address, a.user_agent
                FROM agreement_acceptances a JOIN agreement_versions v ON v.agreement_id = a.agreement_id WHERE a.chama_id = ? ORDER BY a.acceptance_id""", chamaId);
    }

    private Long caseChama(Long caseId) {
        var r = jdbc.queryForList("SELECT chama_id FROM enforcement_cases WHERE case_id = ?", caseId == null ? -1L : caseId);
        if (r.isEmpty()) throw new IllegalArgumentException("Case not found");
        return ((Number) r.get(0).get("chama_id")).longValue();
    }

    private static String csv(List<Map<String, Object>> rows, String... cols) {
        StringBuilder sb = new StringBuilder(String.join(",", cols)).append('\n');
        for (var r : rows) { for (int i = 0; i < cols.length; i++) { if (i > 0) sb.append(','); sb.append(cell(r.get(cols[i]))); } sb.append('\n'); }
        return sb.toString();
    }
    static String cell(Object o) {
        String s = o == null ? "" : o.toString();
        if (!s.isEmpty() && "=+-@\t\r".indexOf(s.charAt(0)) >= 0 && !(o instanceof Number)) s = "'" + s;
        return s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r") ? "\"" + s.replace("\"", "\"\"") + "\"" : s;
    }
    private static byte[] b(String s) { return s.getBytes(StandardCharsets.UTF_8); }
    private static String sha(byte[] x) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(x)); } catch (Exception e) { throw new IllegalStateException(e); }
    }
    private static String safe(String n) { return n == null ? "file" : n.replaceAll("[^A-Za-z0-9._-]", "_"); }
    private static String trunc(String s, int n) { return s.length() > n ? s.substring(0, n) : s; }
    private static String str(Map<String, Object> b, String k) { Object v = b.get(k); return v == null ? null : v.toString(); }
    private static Long lng(Map<String, Object> b, String k) { String v = str(b, k); return v == null || v.isBlank() ? null : Long.valueOf(v.trim()); }
    private static LocalDate date(Map<String, Object> b, String k, LocalDate dflt) {
        String v = str(b, k);
        try { return v == null || v.isBlank() ? dflt : LocalDate.parse(v.trim()); } catch (Exception e) { throw new IllegalArgumentException("Dates look like 2026-10-31"); }
    }
}
