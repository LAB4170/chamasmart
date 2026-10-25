package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.SubscriptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/chamas/{chamaId}/subscription")
@RequiredArgsConstructor
public class SubscriptionController {
    private final SubscriptionService subscriptions;

    @GetMapping("/plans")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> plans(@PathVariable Long chamaId) {
        return ResponseEntity.ok(ApiResponse.success(subscriptions.plans(), "Plans"));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> current(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(subscriptions.current(chamaId, me.getUserId()), "Your plan"));
    }

    @PostMapping("/choose")
    public ResponseEntity<ApiResponse<Map<String, Object>>> choose(@PathVariable Long chamaId, @RequestBody Map<String, Object> b, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(subscriptions.choose(chamaId, me.getUserId(), b.get("plan_code") == null ? null : b.get("plan_code").toString()), "Plan updated"));
    }

    @PostMapping("/checkout")
    public ResponseEntity<ApiResponse<Map<String, Object>>> checkout(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(subscriptions.checkout(chamaId, me.getUserId(), me.getEmail()), "Checkout ready"));
    }
}
