package com.chamasmart.backend.controller;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.repository.*;
import com.chamasmart.backend.security.CustomUserDetails;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/contributions")
@RequiredArgsConstructor
public class ContributionController {

    private final ContributionRepository contributionRepository;
    private final ChamaRepository chamaRepository;
    private final UserRepository userRepository;
    private final ChamaMemberRepository chamaMemberRepository;
    private final FinancialAuditLogRepository auditLogRepository;

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

    @PostMapping("/{chamaId}/record")
    @Transactional
    public ResponseEntity<ApiResponse<ContributionSummaryDto>> recordContribution(
            @PathVariable Long chamaId,
            @RequestBody ContributionRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        
        log.info("REST request to manually record contribution for chama ID: {}", chamaId);
        
        Chama chama = chamaRepository.findById(chamaId)
                .orElseThrow(() -> new RuntimeException("Chama not found"));

        Long targetUserId = request.getUser_id() != null ? request.getUser_id() : request.getUserId();
        if (targetUserId == null) {
            targetUserId = currentUser.getUserId();
        }

        User user = userRepository.findById(targetUserId)
                .orElseThrow(() -> new RuntimeException("Target user not found"));

        String ref = request.getReference() != null ? request.getReference() : request.getReceiptNumber();
        if (ref == null || ref.trim().isEmpty()) {
            ref = "REC-" + System.currentTimeMillis();
        }

        String status = request.getStatus() != null ? request.getStatus() : request.getVerificationStatus();
        if (status == null) {
            status = "COMPLETED";
        }

        String type = request.getContribution_type() != null ? request.getContribution_type() : request.getContributionType();
        if (type == null) {
            type = "REGULAR";
        }

        Contribution contribution = Contribution.builder()
                .chama(chama)
                .user(user)
                .amount(request.getAmount())
                .reference(ref)
                .status(status)
                .contributionType(type)
                .notes(request.getNotes())
                .paymentProof(request.getPaymentProof())
                .isDeleted(false)
                .build();

        Contribution savedContribution = contributionRepository.save(contribution);

        if ("COMPLETED".equalsIgnoreCase(status) || "VERIFIED".equalsIgnoreCase(status) || "APPROVED".equalsIgnoreCase(status)) {
            savedContribution.setStatus("COMPLETED");
            
            // Update ChamaMember total contributions
            chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, targetUserId)
                    .ifPresent(member -> {
                        member.setTotalContributions(member.getTotalContributions().add(request.getAmount()));
                        member.setLastContributionDate(ZonedDateTime.now());
                        chamaMemberRepository.save(member);
                    });

            // Update Chama current fund
            chama.setCurrentFund(chama.getCurrentFund().add(request.getAmount()));
            chamaRepository.save(chama);

            // Write Financial Audit Log
            FinancialAuditLog auditLog = FinancialAuditLog.builder()
                    .user(userRepository.findById(currentUser.getUserId()).orElse(user))
                    .transactionType("MANUAL_CONTRIBUTION")
                    .amount(request.getAmount())
                    .chama(chama)
                    .referenceId(savedContribution.getContributionId())
                    .description("Manual contribution recorded. Reference: " + ref)
                    .ipAddress("127.0.0.1")
                    .userAgent("System-Admin-Console")
                    .build();
            auditLogRepository.save(auditLog);
        }

        return ResponseEntity.ok(ApiResponse.success(ContributionSummaryDto.fromEntity(savedContribution), "Contribution recorded successfully"));
    }

    @PostMapping("/{chamaId}/submit")
    @Transactional
    public ResponseEntity<ApiResponse<ContributionSummaryDto>> submitContribution(
            @PathVariable Long chamaId,
            @RequestBody ContributionRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        
        log.info("REST request to submit contribution receipt for verification for chama ID: {} by user ID: {}", chamaId, currentUser.getUserId());
        
        Chama chama = chamaRepository.findById(chamaId)
                .orElseThrow(() -> new RuntimeException("Chama not found"));

        User user = userRepository.findById(currentUser.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        String ref = request.getReference() != null ? request.getReference() : request.getReceiptNumber();
        if (ref == null || ref.trim().isEmpty()) {
            ref = "SUB-" + System.currentTimeMillis();
        }

        String type = request.getContribution_type() != null ? request.getContribution_type() : request.getContributionType();
        if (type == null) {
            type = "REGULAR";
        }

        Contribution contribution = Contribution.builder()
                .chama(chama)
                .user(user)
                .amount(request.getAmount())
                .reference(ref)
                .status("PENDING")
                .contributionType(type)
                .notes(request.getNotes())
                .paymentProof(request.getPaymentProof())
                .isDeleted(false)
                .build();

        Contribution savedContribution = contributionRepository.save(contribution);
        return ResponseEntity.ok(ApiResponse.success(ContributionSummaryDto.fromEntity(savedContribution), "Receipt submitted successfully. Awaiting verification."));
    }

    @PostMapping("/{chamaId}/bulk-record")
    @Transactional
    public ResponseEntity<ApiResponse<List<ContributionSummaryDto>>> bulkRecordContributions(
            @PathVariable Long chamaId,
            @RequestBody BulkContributionRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        
        log.info("REST request to record bulk contributions for chama ID: {}", chamaId);
        
        Chama chama = chamaRepository.findById(chamaId)
                .orElseThrow(() -> new RuntimeException("Chama not found"));

        List<ContributionSummaryDto> savedDtos = new ArrayList<>();

        if (request.getContributions() != null) {
            for (SingleContributionRequest req : request.getContributions()) {
                Long targetUserId = req.getUserId() != null ? req.getUserId() : req.getUser_id();
                if (targetUserId == null) continue;

                User user = userRepository.findById(targetUserId)
                        .orElseThrow(() -> new RuntimeException("User " + targetUserId + " not found"));

                String ref = req.getReference() != null ? req.getReference() : req.getReceiptNumber();
                if (ref == null || ref.trim().isEmpty()) {
                    ref = "BULK-" + System.currentTimeMillis();
                }

                Contribution contribution = Contribution.builder()
                        .chama(chama)
                        .user(user)
                        .amount(req.getAmount())
                        .reference(ref)
                        .status("COMPLETED")
                        .contributionType("REGULAR")
                        .notes(req.getNotes())
                        .isDeleted(false)
                        .build();

                Contribution savedContribution = contributionRepository.save(contribution);

                // Update ChamaMember total contributions
                chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, targetUserId)
                        .ifPresent(member -> {
                            member.setTotalContributions(member.getTotalContributions().add(req.getAmount()));
                            member.setLastContributionDate(ZonedDateTime.now());
                            chamaMemberRepository.save(member);
                        });

                // Update Chama current fund
                chama.setCurrentFund(chama.getCurrentFund().add(req.getAmount()));
                chamaRepository.save(chama);

                // Write Financial Audit Log
                FinancialAuditLog auditLog = FinancialAuditLog.builder()
                        .user(userRepository.findById(currentUser.getUserId()).orElse(user))
                        .transactionType("BULK_CONTRIBUTION")
                        .amount(req.getAmount())
                        .chama(chama)
                        .referenceId(savedContribution.getContributionId())
                        .description("Bulk contribution recorded. Member ID: " + targetUserId + ", Ref: " + ref)
                        .ipAddress("127.0.0.1")
                        .userAgent("System-Admin-Console")
                        .build();
                auditLogRepository.save(auditLog);

                savedDtos.add(ContributionSummaryDto.fromEntity(savedContribution));
            }
        }

        return ResponseEntity.ok(ApiResponse.success(savedDtos, "Bulk contributions recorded successfully"));
    }

    @PostMapping("/{chamaId}/verify/{contributionId}")
    @Transactional
    public ResponseEntity<ApiResponse<ContributionSummaryDto>> verifyContribution(
            @PathVariable Long chamaId,
            @PathVariable Long contributionId,
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        
        log.info("REST request to verify contribution ID: {} for chama ID: {}", contributionId, chamaId);
        
        Contribution contribution = contributionRepository.findById(contributionId)
                .orElseThrow(() -> new RuntimeException("Contribution not found"));

        if (!contribution.getChama().getChamaId().equals(chamaId)) {
            throw new RuntimeException("Contribution does not belong to this chama");
        }

        String decision = payload.get("status"); // COMPLETED / REJECTED
        if (decision == null) {
            decision = payload.get("decision");
        }

        if (decision == null) {
            throw new RuntimeException("Status or decision parameter is missing");
        }

        if ("COMPLETED".equalsIgnoreCase(decision) || "APPROVED".equalsIgnoreCase(decision) || "VERIFIED".equalsIgnoreCase(decision)) {
            contribution.setStatus("COMPLETED");

            // Update ChamaMember total contributions
            chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, contribution.getUser().getUserId())
                    .ifPresent(member -> {
                        member.setTotalContributions(member.getTotalContributions().add(contribution.getAmount()));
                        member.setLastContributionDate(ZonedDateTime.now());
                        chamaMemberRepository.save(member);
                    });

            // Update Chama current fund
            Chama chama = contribution.getChama();
            chama.setCurrentFund(chama.getCurrentFund().add(contribution.getAmount()));
            chamaRepository.save(chama);

            // Write Financial Audit Log
            FinancialAuditLog auditLog = FinancialAuditLog.builder()
                    .user(userRepository.findById(currentUser.getUserId()).orElse(contribution.getUser()))
                    .transactionType("VERIFIED_CONTRIBUTION")
                    .amount(contribution.getAmount())
                    .chama(chama)
                    .referenceId(contribution.getContributionId())
                    .description("Receipt contribution approved. Ref: " + contribution.getReference())
                    .ipAddress("127.0.0.1")
                    .userAgent("System-Admin-Console")
                    .build();
            auditLogRepository.save(auditLog);
        } else {
            contribution.setStatus("FAILED");
        }

        Contribution updatedContribution = contributionRepository.save(contribution);
        return ResponseEntity.ok(ApiResponse.success(ContributionSummaryDto.fromEntity(updatedContribution), "Contribution verification processed"));
    }

    @GetMapping("/{chamaId}/pending")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<ContributionSummaryDto>>> getPendingContributions(@PathVariable Long chamaId) {
        log.info("REST request to get pending contributions for chama ID: {}", chamaId);
        List<ContributionSummaryDto> pending = contributionRepository.findByChamaChamaIdAndIsDeletedFalse(chamaId).stream()
                .filter(c -> "PENDING".equalsIgnoreCase(c.getStatus()))
                .map(ContributionSummaryDto::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(pending, "Pending contributions retrieved successfully"));
    }

    @GetMapping("/{chamaId}")
    @Transactional(readOnly = true)
    public ResponseEntity<ApiResponse<List<ContributionSummaryDto>>> getAllContributions(
            @PathVariable Long chamaId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        
        log.info("REST request to get contributions for chama ID: {}", chamaId);
        List<ContributionSummaryDto> all = contributionRepository.findByChamaChamaIdAndIsDeletedFalse(chamaId).stream()
                .map(ContributionSummaryDto::fromEntity)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(all, "All contributions retrieved successfully"));
    }

    @DeleteMapping("/{chamaId}/{id}")
    @Transactional
    public ResponseEntity<ApiResponse<Void>> deleteContribution(
            @PathVariable Long chamaId,
            @PathVariable Long id) {
        
        log.info("REST request to soft delete contribution ID: {} for chama ID: {}", id, chamaId);
        Contribution contribution = contributionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Contribution not found"));

        if (!contribution.getChama().getChamaId().equals(chamaId)) {
            throw new RuntimeException("Contribution does not belong to this chama");
        }

        contribution.setIsDeleted(true);
        contribution.setDeletedAt(ZonedDateTime.now());
        contributionRepository.save(contribution);

        return ResponseEntity.ok(ApiResponse.success(null, "Contribution deleted successfully"));
    }
}
