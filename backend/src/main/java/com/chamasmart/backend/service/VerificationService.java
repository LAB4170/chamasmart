package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.Notification;
import com.chamasmart.backend.repository.ChamaMemberRepository;
import com.chamasmart.backend.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * The route to the public listing. A chama applies; the system checks what it can check by itself; the platform administrator checks the rest
 * (documents, identities, who owns the paybill) and approves, asks for changes, or rejects. Approval lasts a year, and an open enforcement case
 * of level 2 or higher removes the listing at once.
 */
@Service
@RequiredArgsConstructor
public class VerificationService {
    /** Checks the administrator ticks after looking at documents or calling the officials. */
    public static final Map<String, String> MANUAL = new LinkedHashMap<>();
    static {
        MANUAL.put("DOCS_RECEIVED", "Opened and read the registration certificate, constitution, officials' resolution and paybill proof");
        MANUAL.put("OFFICIALS_ID_VERIFIED", "National ID documents opened and matched to each official on a video call");
        MANUAL.put("REGISTRATION_VERIFIED", "Registration number confirmed with the issuing body");
        MANUAL.put("PAYBILL_OWNERSHIP", "The chama owns the paybill, till or bank account it collects into");
        MANUAL.put("CALLBACK_DONE", "Called the officials back on the numbers they gave");
    }
    static final int MIN_MEMBERS = 5;

    private final JdbcTemplate jdbc;
    private final MembershipService membership;
    private final AgreementService agreements;
    private final DocumentService documents;
    private final MfaService mfa;
    private final AdminGuard audit;
    private final NotificationRepository notifications;
    private final ChamaMemberRepository members;

    // ---------- chama side ----------

    public Map<String, Object> mine(Long chamaId, Long userId) {
        membership.activeOfficial(chamaId, userId);
        return view(chamaId);
    }

    @Transactional
    public Map<String, Object> apply(Long chamaId, Long userId, Map<String, Object> b) {
        var me = membership.activeOfficial(chamaId, userId);
        if (!"CHAIRPERSON".equalsIgnoreCase(me.getRole())) throw new org.springframework.security.access.AccessDeniedException("Only the chairperson can apply for listing");
        String body = str(b, "registration_body", 120), num = str(b, "registration_number", 60), name = str(b, "registered_name", 160);
        String collect = str(b, "collection_summary", 300), blurb = str(b, "public_blurb", 500), phone = str(b, "contact_phone", 20);
        if (num == null || name == null || body == null) throw new IllegalArgumentException("Give the registering body, the registration number and the registered name");
        if (collect == null) throw new IllegalArgumentException("Say how the chama collects money (paybill, till or bank) and in whose name");
        if (blurb == null || blurb.length() < 30) throw new IllegalArgumentException("Write a short description for the public listing (at least 30 characters)");
        var cur = jdbc.queryForList("SELECT status FROM chama_verifications WHERE chama_id = ?", chamaId);
        String status = cur.isEmpty() ? "DRAFT" : (String) cur.get(0).get("status");
        if (List.of("SUBMITTED", "IN_REVIEW", "APPROVED").contains(status)) throw new IllegalStateException("Your application is already " + status.toLowerCase().replace('_', ' '));
        if (List.of("REJECTED", "SUSPENDED", "REVOKED").contains(status)) throw new IllegalStateException("This chama cannot apply right now. See the notice on your chama or contact support");
        List<Map<String, Object>> notReady = readiness(chamaId).stream().filter(r -> Boolean.TRUE.equals(r.get("auto")) && !Boolean.TRUE.equals(r.get("passed"))).toList();
        if (!notReady.isEmpty()) throw new IllegalStateException("Not ready to apply: " + notReady.get(0).get("label"));
        jdbc.update("""
                INSERT INTO chama_verifications (chama_id, status, registration_body, registration_number, registered_name, collection_summary, public_blurb, contact_phone, submitted_by, submitted_at, updated_at)
                VALUES (?, 'SUBMITTED', ?,?,?,?,?,?,?, now(), now())
                ON CONFLICT (chama_id) DO UPDATE SET status = 'SUBMITTED', registration_body = EXCLUDED.registration_body, registration_number = EXCLUDED.registration_number,
                  registered_name = EXCLUDED.registered_name, collection_summary = EXCLUDED.collection_summary, public_blurb = EXCLUDED.public_blurb,
                  contact_phone = EXCLUDED.contact_phone, submitted_by = EXCLUDED.submitted_by, submitted_at = now(), updated_at = now()""",
                chamaId, body, num, name, collect, blurb, phone, userId);
        return view(chamaId);
    }

    // ---------- checks ----------

    /** What stands between this chama and the listing: automatic checks, then the administrator's checks. */
    public List<Map<String, Object>> readiness(Long chamaId) {
        List<Map<String, Object>> out = new ArrayList<>();
        List<Long> officials = agreements.officialIds(chamaId);
        add(out, "THREE_OFFICIALS", "Chairperson, treasurer and secretary are all appointed", true, officials.size() >= 3);
        boolean emails = !officials.isEmpty() && officials.stream().allMatch(u -> Boolean.TRUE.equals(jdbc.queryForObject("SELECT coalesce(email_verified,false) FROM users WHERE user_id = ?", Boolean.class, u)));
        add(out, "OFFICIALS_EMAIL", "Every official has confirmed their email", true, emails);
        add(out, "OFFICIALS_MFA", "Every official uses two-factor sign-in", true, !officials.isEmpty() && officials.stream().allMatch(mfa::isEnabled));
        Integer paybill = jdbc.queryForObject("SELECT count(*) FROM chama_account_codes WHERE chama_id = ? AND channel = 'OWN_PAYBILL' AND shortcode IS NOT NULL AND shortcode <> ''", Integer.class, chamaId);
        add(out, "OWN_PAYBILL", "The chama collects into its own paybill", true, paybill != null && paybill > 0);
        Integer ms = jdbc.queryForObject("SELECT count(*) FROM chama_members WHERE chama_id = ? AND is_active = true", Integer.class, chamaId);
        add(out, "MIN_MEMBERS", "At least " + MIN_MEMBERS + " active members", true, ms != null && ms >= MIN_MEMBERS);
        Boolean books = jdbc.query("SELECT all_ok FROM ledger_check_results WHERE chama_id = ?", rs -> rs.next() ? rs.getBoolean(1) : Boolean.TRUE, chamaId);
        add(out, "BOOKS_CLEAN", "The latest books check passed", true, Boolean.TRUE.equals(books));
        List<String> lacking = documents.missing(chamaId);
        add(out, "DOCUMENTS_UPLOADED", lacking.isEmpty() ? "All required documents are uploaded" : "Documents still to upload: " + String.join("; ", lacking), true, lacking.isEmpty());
        add(out, "AGREEMENTS", "All three officials accepted the Terms of Use, Operator Agreement and Fraud and Enforcement Policy", true, agreements.allAccepted(chamaId));
        Integer open = jdbc.queryForObject("SELECT count(*) FROM enforcement_cases WHERE chama_id = ? AND status = 'OPEN'", Integer.class, chamaId);
        add(out, "NO_OPEN_CASE", "No open enforcement case", true, open != null && open == 0);
        Map<String, Boolean> done = new HashMap<>();
        jdbc.query("SELECT item_code, passed FROM verification_checks WHERE chama_id = ?", rs -> { done.put(rs.getString(1), rs.getBoolean(2)); }, chamaId);
        MANUAL.forEach((code, label) -> add(out, code, label, false, done.getOrDefault(code, false)));
        return out;
    }

    private static void add(List<Map<String, Object>> l, String code, String label, boolean auto, boolean passed) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", code); m.put("label", label); m.put("auto", auto); m.put("passed", passed);
        l.add(m);
    }

    // ---------- administrator side ----------

    public List<Map<String, Object>> queue(String status) {
        String s = status == null || status.isBlank() ? "SUBMITTED" : status.toUpperCase();
        return jdbc.queryForList("""
                SELECT v.chama_id, c.chama_name, v.status, v.registered_name, v.registration_number, v.submitted_at, v.reviewed_at, v.listed_at, v.next_review_at
                FROM chama_verifications v JOIN chamas c ON c.chama_id = v.chama_id WHERE v.status = ? ORDER BY v.submitted_at NULLS LAST LIMIT 200""", s);
    }

    public Map<String, Object> detail(Long chamaId) {
        Map<String, Object> m = view(chamaId);
        m.put("officials", jdbc.queryForList("""
                SELECT m.user_id, m.role, u.first_name, u.last_name, u.email, u.phone_number, u.email_verified
                FROM chama_members m JOIN users u ON u.user_id = m.user_id
                WHERE m.chama_id = ? AND m.is_active = true AND upper(m.role) IN ('CHAIRPERSON','TREASURER','SECRETARY')""", chamaId));
        m.put("cases", jdbc.queryForList("SELECT * FROM enforcement_cases WHERE chama_id = ? ORDER BY opened_at DESC", chamaId));
        m.put("agreements", agreements.status(chamaId));
        m.put("trail", jdbc.queryForList("SELECT admin_id, action, detail, at FROM admin_actions WHERE chama_id = ? ORDER BY at DESC LIMIT 50", chamaId));
        return m;
    }

    @Transactional
    public Map<String, Object> setCheck(Long adminId, Long chamaId, String item, boolean passed, String note) {
        if (!MANUAL.containsKey(item)) throw new IllegalArgumentException("Unknown check. Use one of " + MANUAL.keySet());
        requireStatus(chamaId, "SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED");
        if (note != null && note.length() > 300) note = note.substring(0, 300);
        jdbc.update("""
                INSERT INTO verification_checks (chama_id, item_code, passed, note, checked_by) VALUES (?,?,?,?,?)
                ON CONFLICT (chama_id, item_code) DO UPDATE SET passed = EXCLUDED.passed, note = EXCLUDED.note, checked_by = EXCLUDED.checked_by, checked_at = now()""",
                chamaId, item, passed, note, adminId);
        jdbc.update("UPDATE chama_verifications SET status = 'IN_REVIEW', updated_at = now() WHERE chama_id = ? AND status = 'SUBMITTED'", chamaId);
        audit.log(adminId, passed ? "CHECK_PASSED" : "CHECK_FAILED", chamaId, item + (note == null ? "" : ": " + note));
        return view(chamaId);
    }

    @Transactional
    public Map<String, Object> requestChanges(Long adminId, Long chamaId, String note) {
        if (note == null || note.trim().length() < 10) throw new IllegalArgumentException("Tell the chama exactly what to fix");
        requireStatus(chamaId, "SUBMITTED", "IN_REVIEW");
        decide(adminId, chamaId, "CHANGES_REQUESTED", note);
        tell(chamaId, "Listing application: changes needed", note.trim());
        audit.log(adminId, "CHANGES_REQUESTED", chamaId, note);
        return view(chamaId);
    }

    @Transactional
    public Map<String, Object> reject(Long adminId, Long chamaId, String note) {
        if (note == null || note.trim().length() < 10) throw new IllegalArgumentException("Give the reason. The chama will be shown it");
        requireStatus(chamaId, "SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED");
        decide(adminId, chamaId, "REJECTED", note);
        tell(chamaId, "Listing application declined", note.trim());
        audit.log(adminId, "REJECTED", chamaId, note);
        return view(chamaId);
    }

    @Transactional
    public Map<String, Object> approve(Long adminId, Long chamaId, String note) {
        requireStatus(chamaId, "SUBMITTED", "IN_REVIEW");
        boolean two = audit.twoPerson();
        if (two) {
            Integer mine = jdbc.queryForObject("SELECT count(*) FROM verification_checks WHERE chama_id = ? AND checked_by = ?", Integer.class, chamaId, adminId);
            if (mine != null && mine > 0) throw new IllegalStateException("You recorded checks on this application, so a different person must approve it");
        }
        var blockers = readiness(chamaId).stream().filter(r -> !Boolean.TRUE.equals(r.get("passed"))).map(r -> (String) r.get("label")).toList();
        if (!blockers.isEmpty()) throw new IllegalStateException("Cannot approve yet: " + blockers.get(0) + (blockers.size() > 1 ? " (and " + (blockers.size() - 1) + " more)" : ""));
        jdbc.update("UPDATE chama_verifications SET status = 'APPROVED', reviewed_by = ?, reviewed_at = now(), review_note = ?, listed_at = now(), next_review_at = now() + interval '1 year', updated_at = now() WHERE chama_id = ?",
                adminId, cut(note), chamaId);
        jdbc.update("UPDATE chamas SET visibility = 'PUBLIC' WHERE chama_id = ?", chamaId);
        tell(chamaId, "Your chama is now listed", "Your chama passed review and appears in the public listing. It will be reviewed again within a year.");
        audit.log(adminId, "APPROVED", chamaId, (two ? "" : "[single operator] ") + (note == null ? "" : note));
        return view(chamaId);
    }

    /** Take a chama off the listing without a fraud finding, for example when its yearly review lapses or the officials ask to leave. */
    @Transactional
    public Map<String, Object> delist(Long adminId, Long chamaId, String note) {
        if (note == null || note.trim().length() < 5) throw new IllegalArgumentException("Give a reason");
        requireStatus(chamaId, "APPROVED");
        decide(adminId, chamaId, "REVOKED", note);
        jdbc.update("UPDATE chamas SET visibility = 'PRIVATE' WHERE chama_id = ?", chamaId);
        tell(chamaId, "Your chama was removed from the public listing", note.trim());
        audit.log(adminId, "DELISTED", chamaId, note);
        return view(chamaId);
    }

    /** Used by enforcement: pull the listing and mark the application suspended. */
    void suspendListing(Long chamaId) {
        jdbc.update("UPDATE chama_verifications SET status = 'SUSPENDED', updated_at = now() WHERE chama_id = ? AND status IN ('APPROVED','SUBMITTED','IN_REVIEW')", chamaId);
        jdbc.update("UPDATE chamas SET visibility = 'PRIVATE' WHERE chama_id = ?", chamaId);
    }

    /** A chama is listed only while approved, inside its review year and with no open case of level 2 or higher. */
    public boolean isListed(Long chamaId) {
        Integer n = jdbc.queryForObject("""
                SELECT count(*) FROM chama_verifications v WHERE v.chama_id = ? AND v.status = 'APPROVED' AND (v.next_review_at IS NULL OR v.next_review_at > now())
                AND NOT EXISTS (SELECT 1 FROM enforcement_cases e WHERE e.chama_id = v.chama_id AND e.status = 'OPEN' AND e.level >= 2)""", Integer.class, chamaId);
        return n != null && n > 0;
    }

    public Set<Long> listedIds() {
        return new HashSet<>(jdbc.queryForList("""
                SELECT v.chama_id FROM chama_verifications v WHERE v.status = 'APPROVED' AND (v.next_review_at IS NULL OR v.next_review_at > now())
                AND NOT EXISTS (SELECT 1 FROM enforcement_cases e WHERE e.chama_id = v.chama_id AND e.status = 'OPEN' AND e.level >= 2)""", Long.class));
    }

    /** Hours a first payout must wait. Newly listed chamas wait longer, because that is when fraud usually shows. */
    public boolean recentlyListed(Long chamaId, int days) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM chama_verifications WHERE chama_id = ? AND status = 'APPROVED' AND listed_at > now() - (? * interval '1 day')", Integer.class, chamaId, days);
        return n != null && n > 0;
    }

    public Map<String, Object> overview(java.util.Set<Permission> has) {
        Map<String, Object> all = overview();
        Map<String, Permission> need = Map.ofEntries(
                Map.entry("chamas", Permission.OVERVIEW_VIEW), Map.entry("listed", Permission.OVERVIEW_VIEW),
                Map.entry("awaiting_review", Permission.VERIFY_VIEW), Map.entry("reviews_due_30_days", Permission.VERIFY_VIEW),
                Map.entry("open_cases", Permission.CASE_VIEW), Map.entry("cases_awaiting_response", Permission.CASE_VIEW), Map.entry("proposals_to_confirm", Permission.CASE_VIEW),
                Map.entry("unrouted_payments", Permission.FINANCE_VIEW), Map.entry("failed_books_checks", Permission.FINANCE_VIEW), Map.entry("past_due_plans", Permission.FINANCE_VIEW),
                Map.entry("agreements_unpublished", Permission.AGREEMENT_MANAGE));
        Map<String, Object> out = new LinkedHashMap<>();
        all.forEach((k, v) -> { Permission p = need.get(k); if (p == null || has.contains(p)) out.put(k, v); });
        return out;
    }

    public Map<String, Object> overview() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("chamas", q("SELECT count(*) FROM chamas WHERE is_active = true"));
        m.put("listed", q("SELECT count(*) FROM chama_verifications WHERE status = 'APPROVED'"));
        m.put("awaiting_review", q("SELECT count(*) FROM chama_verifications WHERE status IN ('SUBMITTED','IN_REVIEW')"));
        m.put("open_cases", q("SELECT count(*) FROM enforcement_cases WHERE status = 'OPEN'"));
        m.put("proposals_to_confirm", q("SELECT count(*) FROM enforcement_cases WHERE status = 'PROPOSED'"));
        m.put("cases_awaiting_response", q("SELECT count(*) FROM enforcement_cases WHERE status = 'OPEN' AND response_text IS NULL"));
        m.put("unrouted_payments", q("SELECT count(*) FROM payment_events WHERE chama_id IS NULL AND status = 'UNMATCHED'"));
        m.put("failed_books_checks", q("SELECT count(*) FROM ledger_check_results WHERE all_ok = false"));
        m.put("past_due_plans", q("SELECT count(*) FROM chama_subscriptions WHERE status IN ('PAST_DUE','SUSPENDED')"));
        m.put("reviews_due_30_days", q("SELECT count(*) FROM chama_verifications WHERE status = 'APPROVED' AND next_review_at < now() + interval '30 days'"));
        m.put("agreements_unpublished", q("SELECT count(*) FROM (SELECT code FROM (VALUES ('TERMS_OF_USE'),('OPERATOR_AGREEMENT'),('FRAUD_POLICY')) t(code) WHERE code NOT IN (SELECT code FROM agreement_versions WHERE status = 'PUBLISHED')) x"));
        return m;
    }


    // ---------- helpers ----------

    private Map<String, Object> view(Long chamaId) {
        Map<String, Object> m = new LinkedHashMap<>();
        var v = jdbc.queryForList("SELECT * FROM chama_verifications WHERE chama_id = ?", chamaId);
        if (v.isEmpty()) { m.put("status", "NOT_STARTED"); m.put("chama_id", chamaId); }
        else m.putAll(v.get(0));
        m.put("listed", isListed(chamaId));
        m.put("readiness", readiness(chamaId));
        m.put("agreements", agreements.status(chamaId));
        m.put("officials", jdbc.queryForList("""
                SELECT m.user_id, m.role, u.first_name, u.last_name
                FROM chama_members m JOIN users u ON u.user_id = m.user_id
                WHERE m.chama_id = ? AND m.is_active = true AND upper(m.role) IN ('CHAIRPERSON','TREASURER','SECRETARY')""", chamaId));
        return m;
    }

    private void requireStatus(Long chamaId, String... allowed) {
        var r = jdbc.queryForList("SELECT status FROM chama_verifications WHERE chama_id = ? FOR UPDATE", chamaId);
        String s = r.isEmpty() ? "NOT_STARTED" : (String) r.get(0).get("status");
        if (!Arrays.asList(allowed).contains(s)) throw new IllegalStateException("This application is " + s.toLowerCase().replace('_', ' ') + " and cannot be changed that way");
    }

    private void decide(Long adminId, Long chamaId, String status, String note) {
        jdbc.update("UPDATE chama_verifications SET status = ?, reviewed_by = ?, reviewed_at = now(), review_note = ?, updated_at = now() WHERE chama_id = ?", status, adminId, cut(note), chamaId);
    }

    void tell(Long chamaId, String title, String message) {
        for (var m : members.findByChamaChamaIdAndIsActiveTrue(chamaId)) {
            if (!MembershipService.isOfficial(m)) continue;
            notifications.save(Notification.builder().user(m.getUser()).title(title).message(cut(message)).type("VERIFICATION").entityType("CHAMA").entityId(chamaId).build());
        }
    }

    private long q(String sql) { Long n = jdbc.queryForObject(sql, Long.class); return n == null ? 0 : n; }
    private static String cut(String s) { return s == null ? null : (s.length() > 480 ? s.substring(0, 480) : s.trim()); }
    private static String str(Map<String, Object> b, String k, int max) {
        Object v = b.get(k);
        if (v == null || v.toString().isBlank()) return null;
        String s = v.toString().trim();
        return s.length() > max ? s.substring(0, max) : s;
    }
}
