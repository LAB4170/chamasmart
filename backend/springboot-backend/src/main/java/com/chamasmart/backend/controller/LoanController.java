package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.LoanService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/loans")
@RequiredArgsConstructor
public class LoanController {

    private final LoanService loanService;

    @PostMapping("/apply")
    public ResponseEntity<ApiResponse<LoanSummaryDto>> applyForLoan(@RequestBody LoanApplicationRequestDto requestDto,
                                                                    @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to apply for loan by user ID: {}", currentUser.getUserId());
        LoanSummaryDto loanSummary = loanService.applyForLoan(requestDto, currentUser.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(loanSummary, "Loan application submitted successfully"));
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<LoanSummaryDto>>> getMyLoans(@AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to fetch loans for user ID: {}", currentUser.getUserId());
        List<LoanSummaryDto> loans = loanService.getMyLoans(currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(loans, "Loans retrieved successfully"));
    }

    @GetMapping("/guarantees/my")
    public ResponseEntity<ApiResponse<List<GuarantorSummaryDto>>> getMyGuarantees(@AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to fetch guarantee requests for user ID: {}", currentUser.getUserId());
        List<GuarantorSummaryDto> guarantees = loanService.getMyGuarantees(currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(guarantees, "Guarantee requests retrieved successfully"));
    }

    @PostMapping("/{id}/guarantee/respond")
    public ResponseEntity<ApiResponse<GuarantorSummaryDto>> respondToGuaranteeRequest(@PathVariable Long id,
                                                                                      @RequestBody Map<String, String> payload,
                                                                                      @AuthenticationPrincipal CustomUserDetails currentUser) {
        String decision = payload.get("decision"); // ACCEPT or REJECT
        log.info("REST request to respond to guarantee for loan ID: {} by user ID: {} with decision: {}", id, currentUser.getUserId(), decision);
        GuarantorSummaryDto responseDto = loanService.respondToGuaranteeRequest(id, currentUser.getUserId(), decision);
        return ResponseEntity.ok(ApiResponse.success(responseDto, "Guarantor response processed successfully"));
    }
}
