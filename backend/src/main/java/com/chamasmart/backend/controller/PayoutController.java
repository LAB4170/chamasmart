package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.PayoutService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/chamas/{chamaId}/payouts")
@RequiredArgsConstructor
public class PayoutController {
    private final PayoutService payouts;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> list(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(payouts.list(chamaId, me.getUserId()), "Payouts"));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> request(@PathVariable Long chamaId, @RequestBody Map<String, Object> b,
            @RequestHeader(value = "Idempotency-Key", required = false) String key, @AuthenticationPrincipal CustomUserDetails me) {
        Object amt = b.get("amount");
        if (amt == null) throw new IllegalArgumentException("Enter an amount above zero");
        return ResponseEntity.ok(ApiResponse.success(payouts.request(chamaId, me.getUserId(), new BigDecimal(amt.toString()),
                str(b, "payee_name"), str(b, "payee_phone"), str(b, "reason"), key), "Payout requested. Another official must approve it."));
    }

    @PostMapping("/{payoutId}/approve")
    public ResponseEntity<ApiResponse<Map<String, Object>>> approve(@PathVariable Long chamaId, @PathVariable Long payoutId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(payouts.approve(chamaId, me.getUserId(), payoutId), "Approved"));
    }

    @PostMapping("/{payoutId}/reject")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reject(@PathVariable Long chamaId, @PathVariable Long payoutId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(payouts.reject(chamaId, me.getUserId(), payoutId, str(b, "note")), "Rejected"));
    }

    @PostMapping("/{payoutId}/cancel")
    public ResponseEntity<ApiResponse<Map<String, Object>>> cancel(@PathVariable Long chamaId, @PathVariable Long payoutId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(payouts.cancel(chamaId, me.getUserId(), payoutId), "Cancelled"));
    }

    @PostMapping("/{payoutId}/paid")
    public ResponseEntity<ApiResponse<Map<String, Object>>> paid(@PathVariable Long chamaId, @PathVariable Long payoutId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(payouts.markPaid(chamaId, me.getUserId(), payoutId, str(b, "reference")), "Recorded as paid"));
    }

    private static String str(Map<String, Object> b, String k) { return b.get(k) == null ? null : b.get(k).toString(); }
}
