package com.chamasmart.backend.controller;
import lombok.extern.slf4j.Slf4j;
import com.chamasmart.backend.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
@RestController
@RequestMapping("/payouts")
@RequiredArgsConstructor
@Slf4j
public class PayoutController {
    // Payouts are recorded through /rosca/cycles/{id}/payout. Real money transfer arrives with the payments phase;
    // until then these generic endpoints must not pretend to move money.
    @GetMapping("/{chamaId}")
    public ResponseEntity<ApiResponse<List<Object>>> getPayouts(@PathVariable Long chamaId) {
        return ResponseEntity.ok(ApiResponse.success(new ArrayList<>(), "No payouts recorded"));
    }
    @GetMapping("/{chamaId}/eligible")
    public ResponseEntity<ApiResponse<List<Object>>> getEligiblePayouts(@PathVariable Long chamaId) {
        return ResponseEntity.ok(ApiResponse.success(new ArrayList<>(), "No eligible payouts"));
    }
    @PostMapping("/{chamaId}/process")
    public ResponseEntity<ApiResponse<Void>> processPayout(@PathVariable Long chamaId, @RequestBody Map<String, Object> payload) {
        log.warn("Rejected generic payout request for chama {}", chamaId);
        return ResponseEntity.status(org.springframework.http.HttpStatus.NOT_IMPLEMENTED)
                .body(ApiResponse.error("Payouts can't be processed here yet. Record a merry-go-round payout from its cycle."));
    }
}
