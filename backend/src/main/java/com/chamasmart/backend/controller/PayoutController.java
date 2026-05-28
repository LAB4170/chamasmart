package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


@RestController
@RequestMapping("/payouts")
@RequiredArgsConstructor
public class PayoutController {
    private static final Logger log = LoggerFactory.getLogger(PayoutController.class);

    @GetMapping("/{chamaId}")
    public ResponseEntity<ApiResponse<List<Object>>> getPayouts(@PathVariable Long chamaId) {
        log.info("REST request to get payouts for chama ID: {}", chamaId);
        return ResponseEntity.ok(ApiResponse.success(new ArrayList<>(), "Payouts retrieved successfully"));
    }

    @GetMapping("/{chamaId}/eligible")
    public ResponseEntity<ApiResponse<List<Object>>> getEligiblePayouts(@PathVariable Long chamaId) {
        log.info("REST request to get eligible payouts for chama ID: {}", chamaId);
        return ResponseEntity.ok(ApiResponse.success(new ArrayList<>(), "Eligible payouts retrieved successfully"));
    }

    @PostMapping("/{chamaId}/process")
    public ResponseEntity<ApiResponse<Void>> processPayout(@PathVariable Long chamaId, @RequestBody Map<String, Object> payload) {
        log.info("REST request to process payout for chama ID: {}", chamaId);
        return ResponseEntity.ok(ApiResponse.success(null, "Payout processed successfully"));
    }
}


