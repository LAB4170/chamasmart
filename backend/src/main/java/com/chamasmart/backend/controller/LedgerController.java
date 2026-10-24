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
}
