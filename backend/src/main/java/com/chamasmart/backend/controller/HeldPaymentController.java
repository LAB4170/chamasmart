package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.AccountNumberService;
import com.chamasmart.backend.service.HeldPaymentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/** Payment account numbers and money held for a decision. */
@RestController
@RequiredArgsConstructor
public class HeldPaymentController {
    private final HeldPaymentService held;
    private final AccountNumberService accounts;
    private final com.chamasmart.backend.service.AdminGuard adminGuard;
    private final com.chamasmart.backend.service.ReconciliationService reconciliation;
    private final com.chamasmart.backend.repository.ChamaMemberRepository members;

    /** The signed-in member's account number in this chama, and how to pay. */
    @GetMapping("/chamas/{chamaId}/payments/my-account")
    public ResponseEntity<ApiResponse<Map<String, Object>>> myAccount(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) {
        members.findByChamaChamaIdAndUserUserId(chamaId, me.getUserId()).filter(m -> Boolean.TRUE.equals(m.getIsActive()))
                .orElseThrow(() -> new AccessDeniedException("You are not an active member of this chama"));
        var a = accounts.forMember(chamaId, me.getUserId());
        var code = accounts.codeFor(chamaId);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("account_number", a.getAccountNumber());
        m.put("channel", code.getChannel());
        m.put("paybill", code.getShortcode());
        return ResponseEntity.ok(ApiResponse.success(m, "Your payment account"));
    }

    @GetMapping("/chamas/{chamaId}/payments/held")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> list(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(held.list(chamaId, me.getUserId()), "Held payments"));
    }

    @PostMapping("/chamas/{chamaId}/payments/held/{eventId}/assign")
    public ResponseEntity<ApiResponse<Map<String, Object>>> assign(@PathVariable Long chamaId, @PathVariable Long eventId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) {
        Object uid = b.get("user_id");
        if (uid == null) throw new IllegalArgumentException("Choose the member this money belongs to");
        return ResponseEntity.ok(ApiResponse.success(held.assign(chamaId, me.getUserId(), eventId, Long.valueOf(uid.toString())), "Assigned and credited"));
    }

    @PostMapping("/chamas/{chamaId}/payments/held/{eventId}/resolve")
    public ResponseEntity<ApiResponse<Map<String, Object>>> resolve(@PathVariable Long chamaId, @PathVariable Long eventId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(held.resolve(chamaId, me.getUserId(), eventId, b.get("reason") == null ? null : b.get("reason").toString()), "Marked as dealt with"));
    }

    /** Platform operator only: money that no chama could claim. */
    @GetMapping("/admin/payments/held")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> unrouted(@AuthenticationPrincipal CustomUserDetails me) {
        adminGuard.require(me, com.chamasmart.backend.service.Permission.FINANCE_VIEW, "UNROUTED_PAYMENTS");
        return ResponseEntity.ok(ApiResponse.success(held.listUnrouted(), "Unrouted payments"));
    }

    /** Officials upload the paybill's M-Pesa statement (CSV text in the body); every line is checked against the books. */
    @PostMapping(value = "/chamas/{chamaId}/payments/reconcile", consumes = {"text/plain", "text/csv", "application/octet-stream"})
    public ResponseEntity<ApiResponse<Map<String, Object>>> reconcile(@PathVariable Long chamaId, @RequestBody String csv, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(reconciliation.reconcile(chamaId, me.getUserId(), csv), "Statement checked"));
    }

    @GetMapping("/chamas/{chamaId}/payments/reconcile/latest")
    public ResponseEntity<ApiResponse<Map<String, Object>>> latestReconciliation(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(reconciliation.latest(chamaId, me.getUserId()), "Latest check"));
    }
}
