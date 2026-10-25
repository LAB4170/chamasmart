package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.LedgerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/ledger")
@RequiredArgsConstructor
public class LedgerController {
    private final LedgerService ledgerService;

    /** Officials only: stored balances against the journal, plus the latest 100 entries. */
    @GetMapping("/{chamaId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> report(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(ledgerService.report(chamaId, currentUser.getUserId()), "Ledger retrieved"));
    }

    /** Trial balance as a CSV file for the accountant. */
    @GetMapping(value = "/{chamaId}/trial-balance.csv", produces = "text/csv")
    public ResponseEntity<String> trialBalance(@PathVariable Long chamaId, @RequestParam(required = false) String asOf, @AuthenticationPrincipal CustomUserDetails currentUser) {
        String csv = ledgerService.trialBalanceCsv(chamaId, currentUser.getUserId(), asOf == null ? null : java.time.LocalDate.parse(asOf));
        return ResponseEntity.ok().header("Content-Disposition", "attachment; filename=trial-balance-" + chamaId + ".csv").body(csv);
    }

    /** Closes the books up to a day that has ended. */
    @PostMapping("/{chamaId}/close-period")
    public ResponseEntity<ApiResponse<Map<String, Object>>> close(@PathVariable Long chamaId, @RequestBody Map<String, String> body, @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(ledgerService.closePeriod(chamaId, currentUser.getUserId(), java.time.LocalDate.parse(body.get("date"))), "Books closed"));
    }
}
