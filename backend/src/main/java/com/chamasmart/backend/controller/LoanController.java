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

import java.util.HashMap;
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

    @GetMapping({"/my", "/my-loans"})
    public ResponseEntity<ApiResponse<List<LoanSummaryDto>>> getMyLoans(@AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to fetch loans for user ID: {}", currentUser.getUserId());
        List<LoanSummaryDto> loans = loanService.getMyLoans(currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(loans, "Loans retrieved successfully"));
    }

    @GetMapping({"/guarantees/my", "/my-guarantees"})
    public ResponseEntity<ApiResponse<List<GuarantorSummaryDto>>> getMyGuarantees(@AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to fetch guarantee requests for user ID: {}", currentUser.getUserId());
        List<GuarantorSummaryDto> guarantees = loanService.getMyGuarantees(currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(guarantees, "Guarantee requests retrieved successfully"));
    }

    @GetMapping("/unified-summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getUnifiedSummary(@AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to get unified loan summary for user ID: {}", currentUser.getUserId());
        List<LoanSummaryDto> borrowedDtoList = loanService.getMyLoans(currentUser.getUserId());
        List<GuarantorSummaryDto> guaranteedDtoList = loanService.getMyGuarantees(currentUser.getUserId());

        java.util.List<Map<String, Object>> borrowed = borrowedDtoList.stream().map(l -> {
            Map<String, Object> m = new HashMap<>();
            m.put("loan_id", l.getLoan_id());
            m.put("chama_id", l.getChama_id());
            m.put("chama_name", l.getChama_name());
            m.put("borrower_id", l.getBorrower_id());
            m.put("borrower_name", l.getBorrower_name());
            m.put("loan_amount", l.getLoan_amount());
            m.put("approved_amount", l.getApproved_amount());
            m.put("interest_rate", l.getInterest_rate());
            m.put("term_months", l.getTerm_months());
            m.put("purpose", l.getPurpose());
            m.put("status", l.getStatus());
            m.put("total_repayable", l.getTotal_repayable());
            m.put("amount_paid", l.getAmount_paid());
            m.put("balance", l.getBalance());
            m.put("monthly_payment", l.getMonthly_payment());
            m.put("due_date", l.getDue_date());
            m.put("created_at", l.getCreated_at());
            m.put("user_role", "BORROWER");
            return m;
        }).toList();

        java.util.List<Map<String, Object>> guaranteed = guaranteedDtoList.stream().map(g -> {
            Map<String, Object> m = new HashMap<>();
            m.put("guarantor_id", g.getGuarantor_id());
            m.put("loan_id", g.getLoan_id());
            m.put("chama_id", g.getChama_id());
            m.put("chama_name", g.getChama_name());
            m.put("borrower_id", g.getBorrower_id());
            m.put("borrower_name", g.getBorrower_name());
            m.put("loan_amount", g.getLoan_amount());
            m.put("term_months", g.getTerm_months());
            m.put("purpose", g.getPurpose());
            m.put("guarantee_amount", g.getGuarantee_amount());
            m.put("guarantee_status", g.getGuarantee_status());
            m.put("created_at", g.getCreated_at());
            m.put("my_guarantee_amount", g.getGuarantee_amount());
            m.put("my_guarantee_status", g.getGuarantee_status());
            m.put("user_role", "GUARANTOR");
            return m;
        }).toList();

        double totalBorrowed = borrowedDtoList.stream()
                .mapToDouble(l -> l.getBalance() != null ? l.getBalance().doubleValue() : 0.0)
                .sum();

        double totalGuaranteed = guaranteedDtoList.stream()
                .mapToDouble(g -> g.getGuarantee_amount() != null ? g.getGuarantee_amount().doubleValue() : 0.0)
                .sum();

        Map<String, Object> summaryDetails = new HashMap<>();
        summaryDetails.put("totalBorrowed", totalBorrowed);
        summaryDetails.put("totalGuaranteed", totalGuaranteed);

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("borrowed", borrowed);
        responseData.put("guaranteed", guaranteed);
        responseData.put("summary", summaryDetails);

        return ResponseEntity.ok(ApiResponse.success(responseData, "Unified loan summary retrieved successfully"));
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
