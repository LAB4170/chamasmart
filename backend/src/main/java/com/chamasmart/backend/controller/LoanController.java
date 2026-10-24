package com.chamasmart.backend.controller;
import lombok.extern.slf4j.Slf4j;
import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.LoanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
@RestController
@RequestMapping("/loans")
@RequiredArgsConstructor
@Slf4j
public class LoanController {
    private final LoanService loanService;
    private final com.chamasmart.backend.service.LoanArrearsService loanArrearsService;
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
    public ResponseEntity<ApiResponse<List<LoanSummaryDto>>> getChamaLoans(@PathVariable Long chamaId,
                                                                           @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to fetch loans for chama ID: {} by user ID: {}", chamaId, currentUser.getUserId());
        List<LoanSummaryDto> loans = loanService.getChamaLoans(chamaId, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(loans, "Chama loans retrieved successfully"));
    }
    @GetMapping("/{chamaId}/{loanId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getLoanById(@PathVariable Long chamaId, @PathVariable Long loanId,
                                                                        @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to fetch loan ID: {} for chama ID: {} by user ID: {}", loanId, chamaId, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(loanService.getLoanDetail(chamaId, loanId, currentUser.getUserId()), "Loan retrieved successfully"));
    }
    @PutMapping("/{chamaId}/{loanId}/approve")
    public ResponseEntity<ApiResponse<Void>> approveLoan(
            @PathVariable Long chamaId, 
            @PathVariable Long loanId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to approve loan ID: {} by user ID: {}", loanId, currentUser.getUserId());
        String outcome = loanService.approveLoan(loanId, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(null, "APPROVED".equals(outcome) ? "Loan approved successfully" : "Your approval is recorded. More officials need to approve this loan before it is disbursed"));
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
    public ResponseEntity<ApiResponse<Map<String, Object>>> repayLoan(
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
        com.chamasmart.backend.domain.LoanRepayment r = loanService.repayLoan(loanId, amount, currentUser.getUserId());
        Map<String, Object> data = new HashMap<>();
        data.put("repayment_id", r.getRepaymentId());
        data.put("status", r.getStatus());
        return ResponseEntity.ok(ApiResponse.success(data, "Repayment submitted. It counts once an official verifies it"));
    }
    @PostMapping("/{chamaId}/{loanId}/call-guarantees")
    public ResponseEntity<ApiResponse<Map<String, Object>>> callGuarantees(@PathVariable Long chamaId, @PathVariable Long loanId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        String outcome = loanService.callGuarantees(chamaId, loanId, currentUser.getUserId());
        boolean waiting = outcome.startsWith("AWAITING");
        Map<String, Object> data = new java.util.HashMap<>();
        data.put("status", waiting ? "AWAITING_SECOND_OFFICIAL" : "RECOVERED");
        if (!waiting) data.put("recovered", new java.math.BigDecimal(outcome.substring(10)));
        return ResponseEntity.ok(ApiResponse.success(data, waiting ? "Request recorded. A different official must confirm it. Nothing has moved yet" : "Guarantors' savings applied to the loan"));
    }
    @PostMapping("/{chamaId}/{loanId}/reschedule")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reschedule(@PathVariable Long chamaId, @PathVariable Long loanId, @RequestBody Map<String, Integer> payload, @AuthenticationPrincipal CustomUserDetails currentUser) {
        String o = loanService.twoOfficialAction(chamaId, loanId, currentUser.getUserId(), "RESCHEDULE", payload.get("months"));
        return ResponseEntity.ok(ApiResponse.success(Map.of("status", o), "DONE".equals(o) ? "Loan rescheduled" : "Request recorded. A different official must confirm it"));
    }
    @PostMapping("/{chamaId}/{loanId}/write-off")
    public ResponseEntity<ApiResponse<Map<String, Object>>> writeOff(@PathVariable Long chamaId, @PathVariable Long loanId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        String o = loanService.twoOfficialAction(chamaId, loanId, currentUser.getUserId(), "WRITE_OFF", null);
        return ResponseEntity.ok(ApiResponse.success(Map.of("status", o), "DONE".equals(o) ? "Loan written off" : "Request recorded. A different official must confirm it"));
    }
    @PutMapping("/{chamaId}/policy")
    public ResponseEntity<ApiResponse<Map<String, Object>>> policy(@PathVariable Long chamaId, @RequestBody Map<String, Object> p, @AuthenticationPrincipal CustomUserDetails currentUser) {
        java.util.function.Function<Object, java.math.BigDecimal> bd = o -> o == null ? null : new java.math.BigDecimal(o.toString());
        var cfg = loanService.updatePolicy(chamaId, currentUser.getUserId(), bd.apply(p.get("late_fee_percent")), bd.apply(p.get("committee_threshold")), p.get("committee_size") == null ? null : Integer.valueOf(p.get("committee_size").toString()));
        return ResponseEntity.ok(ApiResponse.success(Map.of("late_fee_percent", cfg.getLateFeePercent(), "committee_threshold", cfg.getCommitteeThreshold(), "committee_size", cfg.getCommitteeSize()), "Loan policy saved"));
    }
    @GetMapping("/{chamaId}/arrears")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> arrears(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(loanArrearsService.arrears(chamaId, currentUser.getUserId()), "Arrears retrieved"));
    }
    @GetMapping("/{chamaId}/repayments/pending")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> pendingRepayments(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(loanService.pendingRepayments(chamaId, currentUser.getUserId()), "Pending repayments retrieved"));
    }
    @PostMapping("/{chamaId}/repayments/{repaymentId}/verify")
    public ResponseEntity<ApiResponse<Void>> verifyRepayment(@PathVariable Long chamaId, @PathVariable Long repaymentId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        loanService.verifyRepayment(chamaId, repaymentId, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(null, "Repayment verified"));
    }
    @PostMapping("/{chamaId}/repayments/{repaymentId}/reject")
    public ResponseEntity<ApiResponse<Void>> rejectRepayment(@PathVariable Long chamaId, @PathVariable Long repaymentId,
                                                            @RequestBody(required = false) Map<String, String> payload,
                                                            @AuthenticationPrincipal CustomUserDetails currentUser) {
        loanService.rejectRepayment(chamaId, repaymentId, currentUser.getUserId(), payload != null ? payload.get("reason") : null);
        return ResponseEntity.ok(ApiResponse.success(null, "Repayment rejected"));
    }
    @GetMapping("/{chamaId}/reports/analytics")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getChamaAnalytics(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(loanService.analytics(chamaId, currentUser.getUserId()), "Analytics retrieved successfully"));
    }
    @GetMapping("/{chamaId}/limit")
    public ResponseEntity<ApiResponse<Map<String, Object>>> borrowingLimit(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(loanService.borrowingLimit(chamaId, currentUser.getUserId()), "Borrowing limit retrieved"));
    }
    @GetMapping("/{chamaId}/config")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getConfig(@PathVariable Long chamaId,
                                                                      @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(configMap(loanService.getConfig(chamaId, currentUser.getUserId())), "Config retrieved"));
    }
    @PutMapping("/{chamaId}/config")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateConfig(@PathVariable Long chamaId, @RequestBody Map<String, Object> config,
                                                                         @AuthenticationPrincipal CustomUserDetails currentUser) {
        try {
            com.chamasmart.backend.domain.LoanConfig saved = loanService.updateConfig(chamaId, currentUser.getUserId(),
                    toDecimal(config.get("interest_rate")), config.get("interest_type") == null ? null : config.get("interest_type").toString(),
                    toDecimal(config.get("loan_multiplier")), config.get("max_repayment_months") == null ? null : ((Number) config.get("max_repayment_months")).intValue(),
                    config.get("require_guarantors") == null ? null : Boolean.valueOf(config.get("require_guarantors").toString()));
            if (config.get("late_fee_percent") != null || config.get("committee_threshold") != null || config.get("committee_size") != null) {
                saved = loanService.updatePolicy(chamaId, currentUser.getUserId(), toDecimal(config.get("late_fee_percent")), toDecimal(config.get("committee_threshold")),
                        config.get("committee_size") == null ? null : ((Number) config.get("committee_size")).intValue());
            }
            return ResponseEntity.ok(ApiResponse.success(configMap(saved), "Config updated"));
        } catch (NumberFormatException | ClassCastException e) {
            throw new IllegalArgumentException("Loan settings contain an invalid number");
        }
    }
    private static BigDecimal toDecimal(Object o) {
        return o == null ? null : new BigDecimal(o.toString());
    }
    private static Map<String, Object> configMap(com.chamasmart.backend.domain.LoanConfig c) {
        Map<String, Object> m = new HashMap<>();
        m.put("interest_rate", c.getInterestRate());
        m.put("interest_type", c.getInterestType());
        m.put("loan_multiplier", c.getLoanMultiplier());
        m.put("max_repayment_months", c.getMaxRepaymentMonths());
        m.put("require_guarantors", c.getRequireGuarantors());
        m.put("late_fee_percent", c.getLateFeePercent() == null ? BigDecimal.ZERO : c.getLateFeePercent());
        m.put("committee_threshold", c.getCommitteeThreshold() == null ? BigDecimal.valueOf(20000) : c.getCommitteeThreshold());
        m.put("committee_size", c.getCommitteeSize() == null ? 2 : c.getCommitteeSize());
        return m;
    }
}

