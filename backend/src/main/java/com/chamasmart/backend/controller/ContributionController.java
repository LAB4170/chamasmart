package com.chamasmart.backend.controller;
import lombok.extern.slf4j.Slf4j;
import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.security.CustomUserDetails;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
@RestController
@RequestMapping("/contributions")
@RequiredArgsConstructor
@Slf4j
public class ContributionController {
    private final com.chamasmart.backend.service.ContributionService contributionService;
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ContributionRequest {
        private Long user_id;
        private Long userId;
        private BigDecimal amount;
        private String contribution_type;
        private String contributionType;
        private String reference;
        private String receiptNumber;
        private String paymentMethod;
        private String paymentProof;
        private String notes;
        private String status;
        private String verificationStatus;
    }
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BulkContributionRequest {
        private List<SingleContributionRequest> contributions;
    }
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SingleContributionRequest {
        private Long userId;
        private Long user_id;
        private BigDecimal amount;
        private String paymentMethod;
        private String receiptNumber;
        private String reference;
        private String notes;
        private String contributionDate;
        private String verificationStatus;
    }
    private static com.chamasmart.backend.service.ContributionService.Entry entry(ContributionRequest r, Long fallbackUser) {
        Long uid = r.getUser_id() != null ? r.getUser_id() : r.getUserId() != null ? r.getUserId() : fallbackUser;
        return new com.chamasmart.backend.service.ContributionService.Entry(uid, r.getAmount(),
                r.getReference() != null ? r.getReference() : r.getReceiptNumber(),
                r.getContribution_type() != null ? r.getContribution_type() : r.getContributionType(), r.getNotes(), r.getPaymentProof());
    }

    @PostMapping("/{chamaId}/record")
    public ResponseEntity<ApiResponse<ContributionSummaryDto>> recordContribution(@PathVariable Long chamaId, @RequestBody ContributionRequest request,
                                                                                   @AuthenticationPrincipal CustomUserDetails currentUser) {
        String status = request.getStatus() != null ? request.getStatus() : request.getVerificationStatus();
        boolean credited = status == null || List.of("COMPLETED", "VERIFIED", "APPROVED").contains(status.toUpperCase());
        ContributionSummaryDto saved = contributionService.record(chamaId, currentUser.getUserId(), entry(request, currentUser.getUserId()), credited);
        String msg = "PENDING".equalsIgnoreCase(saved.getStatus())
                ? "Saved, waiting for a second official to verify it. It counts once they do"
                : "Contribution recorded successfully";
        return ResponseEntity.ok(ApiResponse.success(saved, msg));
    }

    @PostMapping("/{chamaId}/submit")
    public ResponseEntity<ApiResponse<ContributionSummaryDto>> submitContribution(@PathVariable Long chamaId, @RequestBody ContributionRequest request,
                                                                                   @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(contributionService.submit(chamaId, currentUser.getUserId(), entry(request, currentUser.getUserId())), "Receipt submitted successfully. Awaiting verification."));
    }

    @PostMapping("/{chamaId}/bulk-record")
    public ResponseEntity<ApiResponse<List<ContributionSummaryDto>>> bulkRecordContributions(@PathVariable Long chamaId, @RequestBody BulkContributionRequest request,
                                                                                              @AuthenticationPrincipal CustomUserDetails currentUser) {
        List<com.chamasmart.backend.service.ContributionService.Entry> entries = new ArrayList<>();
        if (request.getContributions() != null) {
            for (SingleContributionRequest r : request.getContributions()) {
                entries.add(new com.chamasmart.backend.service.ContributionService.Entry(r.getUserId() != null ? r.getUserId() : r.getUser_id(), r.getAmount(),
                        r.getReference() != null ? r.getReference() : r.getReceiptNumber(), "REGULAR", r.getNotes(), null));
            }
        }
        List<ContributionSummaryDto> saved = contributionService.bulkRecord(chamaId, currentUser.getUserId(), entries);
        long waiting = saved.stream().filter(x -> "PENDING".equalsIgnoreCase(x.getStatus())).count();
        String msg = waiting > 0
                ? waiting + " of " + saved.size() + " are waiting for a second official to verify them (your own payments and amounts of KES 10,000 or more)"
                : "Bulk contributions recorded successfully";
        return ResponseEntity.ok(ApiResponse.success(saved, msg));
    }

    @PostMapping("/{chamaId}/verify/{contributionId}")
    public ResponseEntity<ApiResponse<ContributionSummaryDto>> verifyContribution(@PathVariable Long chamaId, @PathVariable Long contributionId,
                                                                                   @RequestBody Map<String, String> payload, @AuthenticationPrincipal CustomUserDetails currentUser) {
        String decision = payload.get("status") != null ? payload.get("status") : payload.get("decision");
        if (decision == null) throw new IllegalArgumentException("Status or decision is missing");
        boolean approve = List.of("COMPLETED", "APPROVED", "VERIFIED").contains(decision.toUpperCase());
        return ResponseEntity.ok(ApiResponse.success(contributionService.verify(chamaId, currentUser.getUserId(), contributionId, approve), "Contribution verification processed"));
    }

    @GetMapping("/{chamaId}/pending")
    public ResponseEntity<ApiResponse<List<ContributionSummaryDto>>> getPendingContributions(@PathVariable Long chamaId, @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(contributionService.pending(chamaId, currentUser.getUserId()), "Pending contributions retrieved successfully"));
    }

    @GetMapping("/{chamaId}")
    public ResponseEntity<ApiResponse<List<ContributionSummaryDto>>> getAllContributions(@PathVariable Long chamaId, @RequestParam(required = false) String startDate,
                                                                                          @RequestParam(required = false) String endDate, @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(ApiResponse.success(contributionService.list(chamaId, currentUser.getUserId(), startDate, endDate), "All contributions retrieved successfully"));
    }

    @DeleteMapping("/{chamaId}/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteContribution(@PathVariable Long chamaId, @PathVariable Long id, @RequestParam(required = false) String reason, @AuthenticationPrincipal CustomUserDetails currentUser) {
        contributionService.delete(chamaId, currentUser.getUserId(), id, reason);
        return ResponseEntity.ok(ApiResponse.success(null, "Contribution deleted successfully"));
    }
}
