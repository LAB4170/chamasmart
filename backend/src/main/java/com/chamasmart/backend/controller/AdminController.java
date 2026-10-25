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

/** The platform operator's console. Administrators with two-factor sign-in only; every action is written to a trail that cannot be edited. */
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {
    private final AdminGuard guard;
    private final VerificationService verification;
    private final EnforcementService enforcement;
    private final AgreementService agreements;

    private static <T> ResponseEntity<ApiResponse<T>> ok(T t, String m) { return ResponseEntity.ok(ApiResponse.success(t, m)); }
    private static String s(Map<String, Object> b, String k) { Object v = b.get(k); return v == null ? null : v.toString(); }

    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<Map<String, Object>>> overview(@AuthenticationPrincipal CustomUserDetails me) { guard.require(me); return ok(verification.overview(), "Overview"); }

    @GetMapping("/verifications")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> queue(@RequestParam(required = false) String status, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me); return ok(verification.queue(status), "Applications"); }

    @GetMapping("/verifications/{chamaId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> detail(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me); return ok(verification.detail(chamaId), "Application"); }

    @PostMapping("/verifications/{chamaId}/checks")
    public ResponseEntity<ApiResponse<Map<String, Object>>> check(@PathVariable Long chamaId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) {
        guard.require(me);
        return ok(verification.setCheck(me.getUserId(), chamaId, s(b, "item"), Boolean.parseBoolean(String.valueOf(b.get("passed"))), s(b, "note")), "Check recorded");
    }

    @PostMapping("/verifications/{chamaId}/request-changes")
    public ResponseEntity<ApiResponse<Map<String, Object>>> changes(@PathVariable Long chamaId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me); return ok(verification.requestChanges(me.getUserId(), chamaId, s(b, "note")), "Changes requested"); }

    @PostMapping("/verifications/{chamaId}/reject")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reject(@PathVariable Long chamaId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me); return ok(verification.reject(me.getUserId(), chamaId, s(b, "note")), "Rejected"); }

    @PostMapping("/verifications/{chamaId}/approve")
    public ResponseEntity<ApiResponse<Map<String, Object>>> approve(@PathVariable Long chamaId, @RequestBody(required = false) Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me); return ok(verification.approve(me.getUserId(), chamaId, b == null ? null : s(b, "note")), "Approved and listed"); }

    @PostMapping("/verifications/{chamaId}/delist")
    public ResponseEntity<ApiResponse<Map<String, Object>>> delist(@PathVariable Long chamaId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me); return ok(verification.delist(me.getUserId(), chamaId, s(b, "note")), "Removed from listing"); }

    @GetMapping("/cases")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> cases(@AuthenticationPrincipal CustomUserDetails me) { guard.require(me); return ok(enforcement.openCases(), "Open cases"); }

    @PostMapping("/chamas/{chamaId}/cases")
    public ResponseEntity<ApiResponse<Map<String, Object>>> openCase(@PathVariable Long chamaId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) {
        guard.require(me);
        int level = b.get("level") == null ? 0 : Integer.parseInt(b.get("level").toString());
        return ok(enforcement.open(me.getUserId(), chamaId, level, s(b, "reason"), Boolean.parseBoolean(String.valueOf(b.get("urgent")))), "Notice sent to the chama");
    }

    @PostMapping("/cases/{caseId}/resolve")
    public ResponseEntity<ApiResponse<Map<String, Object>>> resolve(@PathVariable Long caseId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me); return ok(enforcement.resolve(me.getUserId(), caseId, s(b, "note")), "Case closed"); }

    @GetMapping("/agreements")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> agreementList(@AuthenticationPrincipal CustomUserDetails me) { guard.require(me); return ok(agreements.all(), "Agreements"); }

    @GetMapping("/agreements/{id}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> agreement(@PathVariable Long id, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me); return ok(agreements.get(id), "Agreement"); }

    @PostMapping("/agreements")
    public ResponseEntity<ApiResponse<Map<String, Object>>> draft(@RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me); return ok(agreements.createDraft(me.getUserId(), s(b, "code"), s(b, "version"), s(b, "title"), s(b, "body")), "Draft saved"); }

    @PostMapping("/agreements/{id}/publish")
    public ResponseEntity<ApiResponse<Map<String, Object>>> publish(@PathVariable Long id, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me); return ok(agreements.publish(me.getUserId(), id, s(b, "counsel")), "Published"); }

    @GetMapping("/audit")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> audit(@RequestParam(defaultValue = "100") int limit, @AuthenticationPrincipal CustomUserDetails me) { guard.require(me); return ok(verification.trail(limit), "Admin trail"); }
}
