package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.PaymentIntentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/** Payment workflow. Today only the manual provider can be used; card, wallet and M-Pesa prompts report themselves as unavailable. */
@RestController
@RequestMapping("/chamas/{chamaId}/payments")
@RequiredArgsConstructor
public class PaymentIntentController {
    private final PaymentIntentService payments;

    @GetMapping("/providers")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> providers(@PathVariable Long chamaId) {
        return ResponseEntity.ok(ApiResponse.success(payments.providers(), "Ways to pay"));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> mine(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(payments.mineList(chamaId, me.getUserId()), "Your payments"));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> create(@PathVariable Long chamaId, @RequestBody Map<String, Object> b,
                                                                   @RequestHeader(value = "Idempotency-Key", required = false) String key, @AuthenticationPrincipal CustomUserDetails me) {
        Object amt = b.get("amount");
        if (amt == null) throw new IllegalArgumentException("Enter an amount");
        return ResponseEntity.ok(ApiResponse.success(payments.create(chamaId, me.getUserId(), (String) b.get("purpose"), new BigDecimal(amt.toString()),
                (String) b.get("provider"), key != null ? key : (String) b.get("idempotency_key")), "Payment started"));
    }

    @PostMapping("/{intentId}/submit")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submit(@PathVariable Long chamaId, @PathVariable Long intentId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) {
        String ref = ContributionController.checkedReference(b.get("payment_method") == null ? null : b.get("payment_method").toString(),
                b.get("reference") == null ? null : b.get("reference").toString());
        String proof = b.get("proof") == null ? null : b.get("proof").toString();
        return ResponseEntity.ok(ApiResponse.success(payments.submit(chamaId, me.getUserId(), intentId, ref, proof), "Submitted. It counts once an official verifies it."));
    }

    @PostMapping("/{intentId}/cancel")
    public ResponseEntity<ApiResponse<Map<String, Object>>> cancel(@PathVariable Long chamaId, @PathVariable Long intentId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(payments.cancel(chamaId, me.getUserId(), intentId), "Payment cancelled"));
    }
}
