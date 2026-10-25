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

/** The chama's side of the review: the agreements officials accept, the application, and any notices from the platform. */
@RestController
@RequiredArgsConstructor
public class ListingController {
    private final VerificationService verification;
    private final AgreementService agreements;
    private final EnforcementService enforcement;

    private static <T> ResponseEntity<ApiResponse<T>> ok(T t, String m) { return ResponseEntity.ok(ApiResponse.success(t, m)); }

    /** The agreements currently in force, with full text. */
    @GetMapping("/agreements/current")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> current(@AuthenticationPrincipal CustomUserDetails me) { return ok(agreements.published(), "Agreements in force"); }

    @PostMapping("/chamas/{chamaId}/agreements/{agreementId}/accept")
    public ResponseEntity<ApiResponse<Map<String, Object>>> accept(@PathVariable Long chamaId, @PathVariable Long agreementId, @AuthenticationPrincipal CustomUserDetails me) { return ok(agreements.accept(chamaId, me.getUserId(), agreementId), "Accepted"); }

    @GetMapping("/chamas/{chamaId}/listing")
    public ResponseEntity<ApiResponse<Map<String, Object>>> listing(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) { return ok(verification.mine(chamaId, me.getUserId()), "Listing status"); }

    @PostMapping("/chamas/{chamaId}/listing/apply")
    public ResponseEntity<ApiResponse<Map<String, Object>>> apply(@PathVariable Long chamaId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) { return ok(verification.apply(chamaId, me.getUserId(), b), "Application sent"); }

    @GetMapping("/chamas/{chamaId}/notices")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> notices(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) { return ok(enforcement.forChama(chamaId, me.getUserId()), "Notices"); }

    @PostMapping("/chamas/{chamaId}/notices/{caseId}/respond")
    public ResponseEntity<ApiResponse<Map<String, Object>>> respond(@PathVariable Long chamaId, @PathVariable Long caseId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) {
        return ok(enforcement.respond(chamaId, me.getUserId(), caseId, b.get("text") == null ? null : b.get("text").toString()), "Response recorded");
    }
}
