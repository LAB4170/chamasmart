package com.chamasmart.backend.dto;

import com.chamasmart.backend.domain.WelfareClaim;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WelfareClaimSummaryDto {
    private Long claim_id;
    private Long chama_id;
    private String chama_name;
    private Long member_id;
    private String member_name;
    private String event_type;
    private BigDecimal claim_amount;
    private String description;
    private String status;
    private LocalDate date_of_occurrence;
    private String proof_document_url;
    private ZonedDateTime created_at;
    private List<ClaimApprovalDto> approvals;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ClaimApprovalDto {
        private Long approval_id;
        private String approver_name;
        private String status;
        private String comments;
        private ZonedDateTime created_at;
    }

    public static WelfareClaimSummaryDto fromEntity(WelfareClaim claim) {
        List<ClaimApprovalDto> approvalDtos = claim.getApprovals().stream()
                .map(a -> ClaimApprovalDto.builder()
                        .approval_id(a.getApprovalId())
                        .approver_name(a.getApprover().getFirstName() + " " + a.getApprover().getLastName())
                        .status(a.getStatus())
                        .comments(a.getComments())
                        .created_at(a.getCreatedAt())
                        .build())
                .collect(Collectors.toList());

        return WelfareClaimSummaryDto.builder()
                .claim_id(claim.getClaimId())
                .chama_id(claim.getChama().getChamaId())
                .chama_name(claim.getChama().getChamaName())
                .member_id(claim.getMember().getUserId())
                .member_name(claim.getMember().getFirstName() + " " + claim.getMember().getLastName())
                .event_type(claim.getEventType().getEventType())
                .claim_amount(claim.getClaimAmount())
                .description(claim.getDescription())
                .status(claim.getStatus())
                .date_of_occurrence(claim.getDateOfOccurrence())
                .proof_document_url(claim.getProofDocumentUrl())
                .created_at(claim.getCreatedAt())
                .approvals(approvalDtos)
                .build();
    }
}
