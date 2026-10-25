package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import static com.chamasmart.backend.service.Permission.*;

/**
 * The platform operator's console. Every endpoint names the one permission it needs; the guard checks it, and writes refusals and reads of personal data to the trail.
 */
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {
    private final AdminGuard guard;
    private final VerificationService verification;
    private final EnforcementService enforcement;
    private final AgreementService agreements;
    private final StaffService staff;
    private final AdminAuditService trail;
    private final DocumentService documents;

    private static <T> ResponseEntity<ApiResponse<T>> ok(T t, String m) { return ResponseEntity.ok(ApiResponse.success(t, m)); }
    private static String s(Map<String, Object> b, String k) { Object v = b.get(k); return v == null ? null : v.toString(); }
    @SuppressWarnings("unchecked")
    private static List<String> list(Map<String, Object> b, String k) { Object v = b.get(k); return v instanceof List<?> l ? (List<String>) l : null; }

    // ---------- who am I ----------
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Map<String, Object>>> me(@AuthenticationPrincipal CustomUserDetails me) { guard.require(me, null); return ok(staff.me(me.getUserId()), "You"); }

    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<Map<String, Object>>> overview(@AuthenticationPrincipal CustomUserDetails me) {
        var a = guard.require(me, OVERVIEW_VIEW);
        Map<String, Object> o = verification.overview(a.permissions());
        return ok(o, "Overview");
    }

    // ---------- verification ----------
    @GetMapping("/verifications")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> queue(@RequestParam(required = false) String status, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, VERIFY_VIEW, "APPLICATION_QUEUE"); return ok(verification.queue(status), "Applications"); }

    @GetMapping("/verifications/{chamaId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> detail(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, VERIFY_VIEW, "APPLICATION", chamaId); return ok(verification.detail(chamaId), "Application"); }

    @PostMapping("/verifications/{chamaId}/checks")
    public ResponseEntity<ApiResponse<Map<String, Object>>> check(@PathVariable Long chamaId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) {
        guard.require(me, VERIFY_REVIEW, null, chamaId);
        return ok(verification.setCheck(me.getUserId(), chamaId, s(b, "item"), Boolean.parseBoolean(String.valueOf(b.get("passed"))), s(b, "note")), "Check recorded");
    }

    @PostMapping("/verifications/{chamaId}/request-changes")
    public ResponseEntity<ApiResponse<Map<String, Object>>> changes(@PathVariable Long chamaId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, VERIFY_REVIEW, null, chamaId); return ok(verification.requestChanges(me.getUserId(), chamaId, s(b, "note")), "Changes requested"); }

    @PostMapping("/verifications/{chamaId}/reject")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reject(@PathVariable Long chamaId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, VERIFY_REVIEW, null, chamaId); return ok(verification.reject(me.getUserId(), chamaId, s(b, "note")), "Rejected"); }

    @PostMapping("/verifications/{chamaId}/approve")
    public ResponseEntity<ApiResponse<Map<String, Object>>> approve(@PathVariable Long chamaId, @RequestBody(required = false) Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, LISTING_APPROVE, null, chamaId); return ok(verification.approve(me.getUserId(), chamaId, b == null ? null : s(b, "note")), "Approved and listed"); }

    @PostMapping("/verifications/{chamaId}/delist")
    public ResponseEntity<ApiResponse<Map<String, Object>>> delist(@PathVariable Long chamaId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, LISTING_APPROVE, null, chamaId); return ok(verification.delist(me.getUserId(), chamaId, s(b, "note")), "Removed from listing"); }

    // ---------- documents ----------
    @GetMapping("/verifications/{chamaId}/documents")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> docs(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, DOCUMENT_VIEW, "DOCUMENT_LIST", chamaId); return ok(documents.staffList(chamaId), "Documents"); }

    @GetMapping("/documents/{docId}/content")
    public ResponseEntity<byte[]> openDoc(@PathVariable Long docId, @AuthenticationPrincipal CustomUserDetails me) {
        guard.require(me, DOCUMENT_VIEW);
        var f = documents.open(me.getUserId(), docId);
        return ResponseEntity.ok().contentType(org.springframework.http.MediaType.parseMediaType(f.contentType()))
                .header("Content-Disposition", "attachment; filename=\"" + f.name() + "\"")
                .header("X-Content-Type-Options", "nosniff").header("Cache-Control", "no-store").body(f.bytes());
    }

    @PostMapping("/documents/{docId}/hold")
    public ResponseEntity<ApiResponse<Map<String, Object>>> hold(@PathVariable Long docId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, LEGAL_HOLD); return ok(documents.hold(me.getUserId(), docId, Boolean.parseBoolean(String.valueOf(b.get("on"))), s(b, "reason")), "Saved"); }

    @PostMapping("/chamas/{chamaId}/documents/hold")
    public ResponseEntity<ApiResponse<Map<String, Object>>> holdAll(@PathVariable Long chamaId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) {
        guard.require(me, LEGAL_HOLD, null, chamaId);
        String reason = s(b, "reason");
        if (reason == null || reason.trim().length() < 5) throw new IllegalArgumentException("Say why");
        return ok(Map.of("held", documents.holdAll(me.getUserId(), chamaId, reason.trim())), "Held");
    }

    @PostMapping("/documents/{docId}/delete")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteDoc(@PathVariable Long docId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, DOCUMENT_DELETE); return ok(documents.delete(me.getUserId(), docId, s(b, "reason")), "Deleted"); }

    // ---------- cases ----------
    @GetMapping("/cases")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> cases(@AuthenticationPrincipal CustomUserDetails me) { guard.require(me, CASE_VIEW, "CASES"); return ok(enforcement.openCases(), "Open cases"); }

    @PostMapping("/chamas/{chamaId}/cases")
    public ResponseEntity<ApiResponse<Map<String, Object>>> openCase(@PathVariable Long chamaId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) {
        int level = b.get("level") == null ? 0 : Integer.parseInt(b.get("level").toString());
        guard.require(me, level >= 3 ? CASE_ESCALATE : CASE_OPEN, null, chamaId);
        return ok(enforcement.open(me.getUserId(), chamaId, level, s(b, "reason"), Boolean.parseBoolean(String.valueOf(b.get("urgent")))), "Notice recorded");
    }

    @PostMapping("/cases/{caseId}/confirm")
    public ResponseEntity<ApiResponse<Map<String, Object>>> confirm(@PathVariable Long caseId, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, CASE_ESCALATE); return ok(enforcement.confirm(me.getUserId(), caseId), "Notice confirmed and sent"); }

    @PostMapping("/cases/{caseId}/withdraw")
    public ResponseEntity<ApiResponse<Map<String, Object>>> withdraw(@PathVariable Long caseId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, CASE_ESCALATE); return ok(enforcement.cancelProposal(me.getUserId(), caseId, s(b, "note")), "Withdrawn"); }

    @PostMapping("/cases/{caseId}/resolve")
    public ResponseEntity<ApiResponse<Map<String, Object>>> resolve(@PathVariable Long caseId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, CASE_RESOLVE); return ok(enforcement.resolve(me.getUserId(), caseId, s(b, "note")), "Case closed"); }

    // ---------- agreements ----------
    @GetMapping("/agreements")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> agreementList(@AuthenticationPrincipal CustomUserDetails me) { guard.require(me, AGREEMENT_MANAGE); return ok(agreements.all(), "Agreements"); }

    @GetMapping("/agreements/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> agreement(@PathVariable Long id, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, AGREEMENT_MANAGE, "AGREEMENT"); return ok(agreements.get(id), "Agreement"); }

    @PostMapping("/agreements")
    public ResponseEntity<ApiResponse<Map<String, Object>>> draft(@RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, AGREEMENT_MANAGE); return ok(agreements.createDraft(me.getUserId(), s(b, "code"), s(b, "version"), s(b, "title"), s(b, "body")), "Draft saved"); }

    @PostMapping("/agreements/{id}/publish")
    public ResponseEntity<ApiResponse<Map<String, Object>>> publish(@PathVariable Long id, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, AGREEMENT_MANAGE); return ok(agreements.publish(me.getUserId(), id, s(b, "counsel")), "Published"); }

    // ---------- staff and settings (super admin) ----------
    @GetMapping("/staff")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> staffList(@AuthenticationPrincipal CustomUserDetails me) { guard.require(me, STAFF_MANAGE, "STAFF"); return ok(staff.list(), "Staff"); }

    @GetMapping("/roles")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> roles(@AuthenticationPrincipal CustomUserDetails me) { guard.require(me, STAFF_MANAGE); return ok(staff.roles(), "Roles"); }

    @PostMapping("/staff")
    public ResponseEntity<ApiResponse<Map<String, Object>>> addStaff(@RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, STAFF_MANAGE); return ok(staff.add(me.getUserId(), s(b, "email"), list(b, "roles")), "Added to the staff"); }

    @PostMapping("/staff/{userId}/roles")
    public ResponseEntity<ApiResponse<Map<String, Object>>> staffRoles(@PathVariable Long userId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, STAFF_MANAGE); return ok(staff.setRoles(me.getUserId(), userId, list(b, "roles")), "Roles changed"); }

    @PostMapping("/staff/{userId}/{action}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> staffStatus(@PathVariable Long userId, @PathVariable String action, @AuthenticationPrincipal CustomUserDetails me) {
        guard.require(me, STAFF_MANAGE);
        String to = switch (action) { case "suspend" -> "SUSPENDED"; case "reinstate" -> "ACTIVE"; case "remove" -> "REMOVED"; default -> throw new IllegalArgumentException("Unknown action"); };
        return ok(staff.setStatus(me.getUserId(), userId, to), "Done");
    }

    @PostMapping("/roles")
    public ResponseEntity<ApiResponse<Map<String, Object>>> saveRole(@RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, STAFF_MANAGE); return ok(staff.saveRole(me.getUserId(), s(b, "role_code"), s(b, "label"), s(b, "description"), list(b, "permissions")), "Role saved"); }

    @GetMapping("/settings")
    public ResponseEntity<ApiResponse<Map<String, Object>>> settings(@AuthenticationPrincipal CustomUserDetails me) { guard.require(me, SETTINGS_MANAGE); return ok(staff.settings(), "Settings"); }

    @PostMapping("/settings/two-person-rule")
    public ResponseEntity<ApiResponse<Map<String, Object>>> twoPerson(@RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me, SETTINGS_MANAGE); return ok(staff.setTwoPerson(me.getUserId(), Boolean.parseBoolean(String.valueOf(b.get("on")))), "Saved"); }

    // ---------- the trail ----------
    @GetMapping("/audit")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> audit(@RequestParam(defaultValue = "100") int limit, @RequestParam(required = false) String action,
            @RequestParam(required = false) Long adminId, @RequestParam(required = false) Long chamaId, @RequestParam(required = false) String outcome, @AuthenticationPrincipal CustomUserDetails me) {
        guard.require(me, AUDIT_VIEW, "AUDIT_TRAIL");
        return ok(trail.recent(limit, action, adminId, chamaId, outcome), "Admin trail");
    }

    @GetMapping("/audit/verify")
    public ResponseEntity<ApiResponse<Map<String, Object>>> verifyAudit(@AuthenticationPrincipal CustomUserDetails me) { guard.require(me, AUDIT_VIEW, "AUDIT_CHECK"); return ok(trail.verify(), "Trail checked"); }
}
