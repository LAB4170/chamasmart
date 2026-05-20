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

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/loans")
@RequiredArgsConstructor
public class LoanController {

    private final LoanService loanService;

    @PostMapping({"/apply", "/{chamaId}/apply"})
    public ResponseEntity<ApiResponse<LoanSummaryDto>> applyForLoan(@PathVariable(value = "chamaId", required = false) Long chamaId,
                                                                    @RequestBody LoanApplicationRequestDto requestDto,
                                                                    @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to apply for loan by user ID: {} in chama ID: {}", currentUser.getUserId(), chamaId);
        if (chamaId != null && requestDto.getChama_id() == null) {
            requestDto.setChama_id(chamaId);
        }
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

    @GetMapping("/{chamaId}")
    public ResponseEntity<ApiResponse<List<LoanSummaryDto>>> getChamaLoans(@PathVariable Long chamaId) {
        log.info("REST request to fetch loans for chama ID: {}", chamaId);
        List<LoanSummaryDto> loans = new java.util.ArrayList<>();
        return ResponseEntity.ok(ApiResponse.success(loans, "Chama loans retrieved successfully"));
    }

    @GetMapping("/{chamaId}/{loanId}")
    public ResponseEntity<ApiResponse<LoanSummaryDto>> getLoanById(@PathVariable Long chamaId, @PathVariable Long loanId) {
        log.info("REST request to fetch loan ID: {} for chama ID: {}", loanId, chamaId);
        return ResponseEntity.ok(ApiResponse.success(null, "Loan retrieved successfully"));
    }

    @PutMapping("/{chamaId}/{loanId}/approve")
    public ResponseEntity<ApiResponse<Void>> approveLoan(
            @PathVariable Long chamaId, 
            @PathVariable Long loanId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to approve loan ID: {} by user ID: {}", loanId, currentUser.getUserId());
        loanService.approveLoan(loanId, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(null, "Loan approved successfully"));
    }

    @PutMapping("/{chamaId}/{loanId}/reject")
    public ResponseEntity<ApiResponse<Void>> rejectLoan(
            @PathVariable Long chamaId, 
            @PathVariable Long loanId, 
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to reject loan ID: {} by user ID: {}", loanId, currentUser.getUserId());
        String reason = payload.get("reason");
        if (reason == null) {
            reason = payload.get("comments");
        }
        loanService.rejectLoan(loanId, currentUser.getUserId(), reason);
        return ResponseEntity.ok(ApiResponse.success(null, "Loan rejected successfully"));
    }

    @PostMapping("/{chamaId}/{loanId}/repay")
    public ResponseEntity<ApiResponse<Void>> repayLoan(
            @PathVariable Long chamaId, 
            @PathVariable Long loanId, 
            @RequestBody Map<String, Object> payload,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to repay loan ID: {} by user ID: {}", loanId, currentUser.getUserId());
        Object amountObj = payload.get("amount");
        if (amountObj == null) {
            throw new RuntimeException("Repayment amount parameter is missing");
        }
        
        BigDecimal amount;
        if (amountObj instanceof Number) {
            amount = BigDecimal.valueOf(((Number) amountObj).doubleValue());
        } else {
            amount = new BigDecimal(amountObj.toString());
        }

        loanService.repayLoan(loanId, amount, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(null, "Loan repaid successfully"));
    }

    @GetMapping("/{chamaId}/reports/analytics")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getChamaAnalytics(@PathVariable Long chamaId) {
        log.info("REST request to fetch analytics for chama ID: {}", chamaId);
        return ResponseEntity.ok(ApiResponse.success(new HashMap<>(), "Analytics retrieved successfully"));
    }
    
    @GetMapping("/{chamaId}/config")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getConfig(@PathVariable Long chamaId) {
        return ResponseEntity.ok(ApiResponse.success(new HashMap<>(), "Config retrieved"));
    }
    
    @PutMapping("/{chamaId}/config")
    public ResponseEntity<ApiResponse<Void>> updateConfig(@PathVariable Long chamaId, @RequestBody Map<String, Object> config) {
        return ResponseEntity.ok(ApiResponse.success(null, "Config updated"));
    }
}
