package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WelfareService {

    private final WelfareConfigRepository welfareConfigRepository;
    private final WelfareFundRepository welfareFundRepository;
    private final WelfareClaimRepository welfareClaimRepository;
    private final WelfareClaimApprovalRepository welfareClaimApprovalRepository;
    private final ChamaRepository chamaRepository;
    private final UserRepository userRepository;
    private final ChamaMemberRepository chamaMemberRepository;

    private ChamaMember validateUserMembershipAndActiveStatus(Long chamaId, Long userId) {
        return chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, userId)
                .filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("Security Violation: User ID " + userId + " is not an active member of Chama ID " + chamaId));
    }

    private ChamaMember validateUserIsOfficial(Long chamaId, Long userId) {
        ChamaMember member = validateUserMembershipAndActiveStatus(chamaId, userId);
        if (!"CHAIRPERSON".equalsIgnoreCase(member.getRole()) && !"TREASURER".equalsIgnoreCase(member.getRole()) && !"SECRETARY".equalsIgnoreCase(member.getRole())) {
            throw new org.springframework.security.access.AccessDeniedException("Security Violation: User ID " + userId + " lacks official administrative privileges for Chama ID " + chamaId);
        }
        return member;
    }

    @Transactional
    public WelfareConfigDto createConfig(WelfareConfigDto dto, Long chamaId, Long userId) {
        log.info("Creating welfare config event '{}' for chama ID: {} by user ID: {}", dto.getEvent_type(), chamaId, userId);
        validateUserIsOfficial(chamaId, userId);
        Chama chama = chamaRepository.findById(chamaId)
                .orElseThrow(() -> new RuntimeException("Chama not found"));

        WelfareConfig config = WelfareConfig.builder()
                .chama(chama)
                .eventType(dto.getEvent_type())
                .description(dto.getDescription())
                .payoutAmount(dto.getPayout_amount())
                .contributionType(dto.getContribution_type() != null ? dto.getContribution_type() : "PERIODIC")
                .contributionAmount(dto.getContribution_amount() != null ? dto.getContribution_amount() : BigDecimal.ZERO)
                .isActive(true)
                .build();

        WelfareConfig savedConfig = welfareConfigRepository.save(config);

        // Ensure WelfareFund exists
        welfareFundRepository.findByChamaChamaId(chamaId).orElseGet(() -> {
            WelfareFund fund = WelfareFund.builder()
                    .chama(chama)
                    .balance(BigDecimal.ZERO)
                    .build();
            return welfareFundRepository.save(fund);
        });

        log.info("Successfully created welfare config ID: {}", savedConfig.getConfigId());
        return WelfareConfigDto.fromEntity(savedConfig);
    }

    @Transactional
    public WelfareClaimSummaryDto fileClaim(WelfareClaimRequestDto requestDto, Long memberUserId) {
        log.info("Filing welfare claim for user ID: {} in chama ID: {}", memberUserId, requestDto.getChama_id());

        validateUserMembershipAndActiveStatus(requestDto.getChama_id(), memberUserId);

        User member = userRepository.findById(memberUserId)
                .orElseThrow(() -> new RuntimeException("Member user not found"));

        Chama chama = chamaRepository.findById(requestDto.getChama_id())
                .orElseThrow(() -> new RuntimeException("Chama not found"));

        WelfareConfig eventType = welfareConfigRepository.findById(requestDto.getEvent_type_id())
                .orElseThrow(() -> new RuntimeException("Welfare event type not found"));

        WelfareClaim claim = WelfareClaim.builder()
                .chama(chama)
                .member(member)
                .eventType(eventType)
                .claimAmount(requestDto.getClaim_amount() != null ? requestDto.getClaim_amount() : eventType.getPayoutAmount())
                .description(requestDto.getDescription())
                .dateOfOccurrence(requestDto.getDate_of_occurrence())
                .proofDocumentUrl(requestDto.getProof_document_url())
                .status("SUBMITTED")
                .build();

        WelfareClaim savedClaim = welfareClaimRepository.save(claim);
        log.info("Successfully filed welfare claim ID: {}", savedClaim.getClaimId());
        return WelfareClaimSummaryDto.fromEntity(savedClaim);
    }

    @Transactional
    public WelfareClaimSummaryDto approveClaim(Long claimId, Long approverUserId, String decision, String comments) {
        log.info("Processing claim approval for claim ID: {} by approver ID: {}, decision: {}", claimId, approverUserId, decision);

        WelfareClaim claim = welfareClaimRepository.findByIdWithPessimisticLock(claimId)
                .orElseThrow(() -> new RuntimeException("Welfare claim not found"));

        validateUserIsOfficial(claim.getChama().getChamaId(), approverUserId);

        if (!"SUBMITTED".equals(claim.getStatus()) && !"VERIFIED".equals(claim.getStatus())) {
            throw new RuntimeException("Claim is not in a valid state for approval. Current status: " + claim.getStatus());
        }

        User approver = userRepository.findById(approverUserId)
                .orElseThrow(() -> new RuntimeException("Approver user not found"));

        WelfareClaimApproval approval = WelfareClaimApproval.builder()
                .claim(claim)
                .approver(approver)
                .status(decision.toUpperCase()) // APPROVED, REJECTED
                .comments(comments)
                .build();

        welfareClaimApprovalRepository.save(approval);

        // Check consensus among officials
        List<WelfareClaimApproval> approvals = welfareClaimApprovalRepository.findByClaimClaimId(claimId);
        boolean anyRejected = approvals.stream().anyMatch(a -> "REJECTED".equals(a.getStatus()));
        boolean allApproved = approvals.stream().allMatch(a -> "APPROVED".equals(a.getStatus()));

        if (anyRejected) {
            claim.setStatus("REJECTED");
            claim.setRejectionReason(comments);
            claim.setApprovedAt(ZonedDateTime.now());
            claim.setApprovedBy(approver);
        } else if (allApproved && approvals.size() >= 2) { // Assume 2 official signatures required
            claim.setStatus("APPROVED");
            claim.setApprovedAt(ZonedDateTime.now());
            claim.setApprovedBy(approver);

            // Disburse from Welfare Fund
            WelfareFund fund = welfareFundRepository.findByChamaIdWithPessimisticLock(claim.getChama().getChamaId())
                    .orElseThrow(() -> new RuntimeException("Welfare fund not found"));

            if (fund.getBalance().compareTo(claim.getClaimAmount()) < 0) {
                log.warn("Insufficient welfare funds for Chama ID: {}. Claim approved but awaiting fund replenishment.", claim.getChama().getChamaId());
            } else {
                fund.setBalance(fund.getBalance().subtract(claim.getClaimAmount()));
                welfareFundRepository.save(fund);
                claim.setStatus("PAID");
                log.info("Welfare claim ID: {} fully approved and disbursed from fund.", claimId);
            }
        }

        WelfareClaim updatedClaim = welfareClaimRepository.save(claim);
        return WelfareClaimSummaryDto.fromEntity(updatedClaim);
    }

    @Transactional(readOnly = true)
    public List<WelfareConfigDto> getConfigsByChamaId(Long chamaId) {
        log.info("Fetching welfare configs for chama ID: {}", chamaId);
        return welfareConfigRepository.findByChamaChamaIdAndIsActiveTrue(chamaId).stream()
                .map(WelfareConfigDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<WelfareClaimSummaryDto> getClaimsByChamaId(Long chamaId) {
        log.info("Fetching welfare claims for chama ID: {}", chamaId);
        return welfareClaimRepository.findByChamaChamaIdOrderByCreatedAtDesc(chamaId).stream()
                .map(WelfareClaimSummaryDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<WelfareClaimSummaryDto> getMyClaims(Long userId) {
        log.info("Fetching welfare claims for user ID: {}", userId);
        return welfareClaimRepository.findByMemberUserId(userId).stream()
                .map(WelfareClaimSummaryDto::fromEntity)
                .collect(Collectors.toList());
    }
}
