package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.LoanCoverService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/loans/{chamaId}/cover")
@RequiredArgsConstructor
public class LoanCoverController {
    private final LoanCoverService cover;

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> overview(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails me) {
        return ResponseEntity.ok(ApiResponse.success(cover.overview(chamaId, me.getUserId()), "Loan cover"));
    }

    @PutMapping("/percent")
    public ResponseEntity<ApiResponse<Map<String, Object>>> percent(@PathVariable Long chamaId, @RequestBody Map<String, Object> body, @AuthenticationPrincipal CustomUserDetails me) {
        Object p = body.get("cover_percent");
        if (p == null) throw new IllegalArgumentException("Enter the premium percent");
        BigDecimal saved = cover.setPercent(chamaId, me.getUserId(), new BigDecimal(p.toString()));
        return ResponseEntity.ok(ApiResponse.success(Map.of("cover_percent", saved), "Cover premium saved. It applies to loans approved from now on."));
    }

    @PostMapping("/claims")
    public ResponseEntity<ApiResponse<Map<String, Object>>> request(@PathVariable Long chamaId, @RequestBody Map<String, Object> body, @AuthenticationPrincipal CustomUserDetails me) {
        Object loan = body.get("loan_id");
        if (loan == null) throw new IllegalArgumentException("Choose the loan");
        return ResponseEntity.ok(ApiResponse.success(cover.request(chamaId, Long.valueOf(loan.toString()), me.getUserId(),
                (String) body.get("reason"), (String) body.get("details")), "Claim recorded. A different official must decide it."));
    }

    @PostMapping("/claims/{claimId}/decision")
    public ResponseEntity<ApiResponse<Map<String, Object>>> decide(@PathVariable Long chamaId, @PathVariable Long claimId, @RequestBody Map<String, Object> body, @AuthenticationPrincipal CustomUserDetails me) {
        boolean approve = "APPROVED".equalsIgnoreCase(String.valueOf(body.get("decision")));
        return ResponseEntity.ok(ApiResponse.success(cover.decide(chamaId, claimId, me.getUserId(), approve, (String) body.get("note")), "Decision recorded"));
    }
}
