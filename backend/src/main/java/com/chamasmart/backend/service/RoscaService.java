package com.chamasmart.backend.service;
import lombok.extern.slf4j.Slf4j;
import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.stream.Collectors;
@Service
@RequiredArgsConstructor
@Slf4j
public class RoscaService {
    private final RoscaCycleRepository roscaCycleRepository;
    private final RoscaRosterRepository roscaRosterRepository;
    private final ChamaRepository chamaRepository;
    private final ChamaMemberRepository chamaMemberRepository;
    private final UserRepository userRepository;
    private final ContributionRepository contributionRepository;
    private final FinancialAuditLogRepository auditLogRepository;
    private final MembershipService membershipService;
    private final ContributionService contributionService;
    private final LoanRepository loanRepository;
    private final LedgerService ledger;
    @org.springframework.beans.factory.annotation.Value("${app.finance.dual-approval-threshold:10000}")
    private BigDecimal dualApprovalThreshold = BigDecimal.valueOf(10000);
    @Transactional
    public RoscaCycleDto createCycle(RoscaCycleDto dto, Long chamaId, Long actorId) {
        membershipService.activeOfficial(chamaId, actorId);
        log.info("Creating ROSCA cycle '{}' for chama ID: {}", dto.getCycle_name(), chamaId);
        Chama chama = chamaRepository.findById(chamaId)
                .orElseThrow(() -> new RuntimeException("Chama not found"));
        if (!"ROSCA".equalsIgnoreCase(chama.getChamaType())) {
            throw new RuntimeException("Chama is not configured as a ROSCA / Merry-Go-Round group");
        }
        if (dto.getCycle_name() == null || dto.getCycle_name().isBlank()) {
            throw new IllegalArgumentException("Give the cycle a name");
        }
        if (dto.getContribution_amount() != null && dto.getContribution_amount().signum() <= 0) {
            throw new IllegalArgumentException("The contribution amount must be more than zero");
        }
        if (roscaCycleRepository.findByChamaChamaId(chamaId).stream().anyMatch(c -> "ACTIVE".equalsIgnoreCase(c.getStatus()))) {
            throw new IllegalStateException("This chama already has an active cycle. Finish or cancel it first.");
        }
        List<ChamaMember> activeMembers = chamaMemberRepository.findByChamaChamaIdAndIsActiveTrue(chamaId);
        if (activeMembers.isEmpty()) {
            throw new RuntimeException("Cannot create a ROSCA cycle with zero active members");
        }
        RoscaCycle cycle = RoscaCycle.builder()
                .chama(chama)
                .cycleName(dto.getCycle_name())
                .startDate(dto.getStart_date() != null ? dto.getStart_date() : LocalDate.now())
                .endDate(dto.getEnd_date() != null ? dto.getEnd_date() : LocalDate.now().plusMonths(activeMembers.size()))
                .totalMembers(activeMembers.size())
                .contributionAmount(dto.getContribution_amount() != null ? dto.getContribution_amount() : chama.getContributionAmount())
                .payoutOrder(dto.getPayout_order() != null ? dto.getPayout_order() : "ROTATIONAL")
                .status("ACTIVE")
                .build();
        RoscaCycle savedCycle = roscaCycleRepository.save(cycle);
        // Assign initial roster positions sequentially
        int position = 1;
        for (ChamaMember member : activeMembers) {
            RoscaRoster roster = RoscaRoster.builder()
                    .cycle(savedCycle)
                    .user(member.getUser())
                    .position(position)
                    .status("ACTIVE")
                    .payoutDate(savedCycle.getStartDate().plusMonths(position - 1))
                    .build();
            roscaRosterRepository.save(roster);
            position++;
        }
        log.info("Successfully created ROSCA cycle ID: {} with {} roster positions", savedCycle.getCycleId(), activeMembers.size());
        List<RoscaRoster> rosterList = roscaRosterRepository.findByCycleCycleIdOrderByPositionAsc(savedCycle.getCycleId());
        return RoscaCycleDto.fromEntity(savedCycle, rosterList);
    }
    @Transactional(readOnly = true)
    public List<RoscaCycleDto> getCyclesByChamaId(Long chamaId, Long actorId) {
        membershipService.activeMember(chamaId, actorId);
        log.info("Fetching ROSCA cycles for chama ID: {}", chamaId);
        List<RoscaCycle> cycles = roscaCycleRepository.findByChamaChamaId(chamaId);
        return cycles.stream().map(cycle -> {
            List<RoscaRoster> roster = roscaRosterRepository.findByCycleCycleIdOrderByPositionAsc(cycle.getCycleId());
            return RoscaCycleDto.fromEntity(cycle, roster);
        }).collect(Collectors.toList());
    }
    @Transactional
    /** Returns PAID when money moved, or AWAITING_SECOND_OFFICIAL when this call only requested a large payout. */
    public String processPayout(Long cycleId, Long officerUserId) {
        log.info("Processing ROSCA pot payout for cycle ID: {} by officer ID: {}", cycleId, officerUserId);
        RoscaCycle cycle = roscaCycleRepository.findByIdWithPessimisticLock(cycleId)
                .orElseThrow(() -> new RuntimeException("ROSCA cycle not found"));
        Chama chama = chamaRepository.findByIdWithPessimisticLock(cycle.getChama().getChamaId())
                .orElseThrow(() -> new RuntimeException("Chama not found"));
        // Validate officer rights
        ChamaMember officer = chamaMemberRepository.findByChamaChamaIdAndUserUserId(chama.getChamaId(), officerUserId)
                .filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("You are not an active member of this chama"));
        if (!"CHAIRPERSON".equalsIgnoreCase(officer.getRole()) && !"TREASURER".equalsIgnoreCase(officer.getRole()) && !"SECRETARY".equalsIgnoreCase(officer.getRole())) {
            throw new org.springframework.security.access.AccessDeniedException("Lacks official privileges to trigger payout");
        }
        if (!"ACTIVE".equalsIgnoreCase(cycle.getStatus())) {
            throw new IllegalStateException("This cycle is " + cycle.getStatus().toLowerCase() + ", so no payout can be recorded");
        }
        // Find the next recipient. Members who have left are skipped; the skip is recorded.
        List<RoscaRoster> rosterList = roscaRosterRepository.findByCycleCycleIdOrderByPositionAsc(cycleId);
        RoscaRoster nextRecipient = null;
        for (RoscaRoster r : rosterList) {
            if (!"ACTIVE".equalsIgnoreCase(r.getStatus()) && !"PAYOUT_PENDING".equalsIgnoreCase(r.getStatus())) continue;
            boolean stillIn = chamaMemberRepository.findByChamaChamaIdAndUserUserId(chama.getChamaId(), r.getUser().getUserId())
                    .filter(ChamaMember::getIsActive).isPresent();
            if (!stillIn) {
                r.setStatus("SKIPPED");
                roscaRosterRepository.save(r);
                auditLogRepository.save(FinancialAuditLog.builder()
                        .user(userRepository.getReferenceById(officerUserId)).transactionType("ROSCA_SLOT_SKIPPED").chama(chama).referenceId(cycleId)
                        .description("Roster position " + r.getPosition() + " skipped because the member is no longer active in this chama")
                        .ipAddress(com.chamasmart.backend.security.ClientIp.current())
                        .userAgent(com.chamasmart.backend.security.ClientIp.currentUserAgent()).build());
                continue;
            }
            nextRecipient = r;
            break;
        }
        if (nextRecipient == null) {
            throw new RuntimeException("No active roster positions left to pay out in this cycle");
        }
        final RoscaRoster recipientRow = nextRecipient;
        if (recipientRow.getUser().getUserId().equals(officerUserId)) {
            throw new org.springframework.security.access.AccessDeniedException("You are the next recipient, so another official must record this payout");
        }
        if (loanRepository.findByBorrowerUserId(recipientRow.getUser().getUserId()).stream().anyMatch(l -> "DEFAULTED".equalsIgnoreCase(l.getStatus()))) {
            throw new IllegalStateException("The next recipient has a defaulted loan. Settle it before releasing their pot");
        }
        // Pot amount is total members * contribution amount
        BigDecimal potAmount = cycle.getContributionAmount().multiply(BigDecimal.valueOf(cycle.getTotalMembers()));
        if (chama.getCurrentFund().compareTo(potAmount) < 0) {
            throw new RuntimeException("Insufficient chama funds to disburse the ROSCA pot. Available: " 
                    + chama.getCurrentFund() + ", Required: " + potAmount);
        }
        // Large pots need two officials: one asks, a different one releases.
        // If fewer than two officials could act (the recipient cannot), a second signature is impossible, so one official may proceed. The audit row says so.
        long eligibleOfficials = chamaMemberRepository.findByChamaChamaIdAndIsActiveTrue(chama.getChamaId()).stream()
                .filter(m -> m.getRole() != null && List.of("CHAIRPERSON", "TREASURER", "SECRETARY").contains(m.getRole().toUpperCase()))
                .filter(m -> m.getUser() != null && !m.getUser().getUserId().equals(recipientRow.getUser().getUserId()))
                .count();
        if (potAmount.compareTo(dualApprovalThreshold) >= 0 && eligibleOfficials >= 2) {
            if (!"PAYOUT_PENDING".equalsIgnoreCase(recipientRow.getStatus())) {
                recipientRow.setStatus("PAYOUT_PENDING");
                recipientRow.setPayoutRequestedBy(officerUserId);
                roscaRosterRepository.save(recipientRow);
                auditLogRepository.save(FinancialAuditLog.builder()
                        .user(userRepository.getReferenceById(officerUserId)).transactionType("ROSCA_PAYOUT_REQUESTED").amount(potAmount).chama(chama).referenceId(cycleId)
                        .description("Pot payout requested for position " + recipientRow.getPosition() + ". A different official must release it")
                        .ipAddress(com.chamasmart.backend.security.ClientIp.current())
                        .userAgent(com.chamasmart.backend.security.ClientIp.currentUserAgent()).build());
                return "AWAITING_SECOND_OFFICIAL";
            }
            if (officerUserId.equals(recipientRow.getPayoutRequestedBy())) {
                throw new org.springframework.security.access.AccessDeniedException("You requested this payout, so a different official must release it");
            }
        }
        // Deduct from Chama treasury
        chama.setCurrentFund(chama.getCurrentFund().subtract(potAmount));
        chamaRepository.save(chama);
        ledger.post(chama, LedgerEntry.CHAMA_FUND, potAmount.negate(), "ROSCA_POT_PAYOUT", "ROSCA_CYCLE", cycleId, officerUserId, "Pot to roster position " + recipientRow.getPosition());
        // Update roster entry to PAID
        nextRecipient.setStatus("PAID");
        roscaRosterRepository.save(nextRecipient);
        // Check if this was the last payout in the roster
        boolean hasMoreActive = rosterList.stream()
                .anyMatch(r -> "ACTIVE".equalsIgnoreCase(r.getStatus()) && !r.getRosterId().equals(recipientRow.getRosterId()));
        if (!hasMoreActive) {
            cycle.setStatus("COMPLETED");
            roscaCycleRepository.save(cycle);
        }
        // Save Financial Audit Log
        String recipientFullName = nextRecipient.getUser().getFirstName() + " " + nextRecipient.getUser().getLastName();
        FinancialAuditLog auditLog = FinancialAuditLog.builder()
                .user(nextRecipient.getUser())
                .transactionType("ROSCA_POT_PAYOUT")
                .amount(potAmount)
                .chama(chama)
                .referenceId(cycleId)
                .description("ROSCA Pot Disbursed. Cycle: " + cycle.getCycleName() + ", Recipient: " + recipientFullName + ", Position: " + nextRecipient.getPosition())
                .ipAddress(com.chamasmart.backend.security.ClientIp.current())
                .userAgent(com.chamasmart.backend.security.ClientIp.currentUserAgent())
                .build();
        auditLogRepository.save(auditLog);
        log.info("Successfully completed pot payout of KES {} to user: {}", potAmount, recipientFullName);
        return "PAID";
    }
    /** A member reports a payment for the active cycle. Nothing is credited until an official verifies it. */
    @Transactional
    public ContributionSummaryDto makeContribution(Long chamaId, Long cycleId, Long userId, BigDecimal amount) {
        RoscaCycle cycle = requireCycle(cycleId, chamaId);
        if (!"ACTIVE".equalsIgnoreCase(cycle.getStatus())) {
            throw new IllegalStateException("This cycle is not active");
        }
        return contributionService.submit(chamaId, userId,
                new ContributionService.Entry(userId, amount, null, "ROSCA", "[cycle:" + cycleId + "] " + cycle.getCycleName(), null));
    }

    private RoscaCycle requireCycle(Long cycleId, Long chamaId) {
        RoscaCycle cycle = roscaCycleRepository.findById(cycleId).orElseThrow(() -> new IllegalArgumentException("ROSCA cycle not found"));
        if (chamaId != null && !cycle.getChama().getChamaId().equals(chamaId)) {
            throw new IllegalArgumentException("ROSCA cycle not found");
        }
        return cycle;
    }

    @Transactional(readOnly = true)
    public RoscaCycleDto getCycle(Long cycleId, Long actorId) {
        RoscaCycle cycle = requireCycle(cycleId, null);
        membershipService.activeMember(cycle.getChama().getChamaId(), actorId);
        return RoscaCycleDto.fromEntity(cycle, roscaRosterRepository.findByCycleCycleIdOrderByPositionAsc(cycleId));
    }

    @Transactional(readOnly = true)
    public List<ContributionSummaryDto> getCycleContributions(Long cycleId, Long actorId) {
        RoscaCycle cycle = requireCycle(cycleId, null);
        Long chamaId = cycle.getChama().getChamaId();
        return contributionService.list(chamaId, actorId, null, null).stream()
                .filter(c -> "ROSCA".equalsIgnoreCase(c.getContribution_type()) && c.getNotes() != null && c.getNotes().startsWith("[cycle:" + cycleId + "]"))
                .collect(Collectors.toList());
    }

    @Transactional
    public void cancelCycle(Long cycleId, Long actorId) {
        RoscaCycle cycle = roscaCycleRepository.findByIdWithPessimisticLock(cycleId).orElseThrow(() -> new IllegalArgumentException("ROSCA cycle not found"));
        membershipService.activeOfficial(cycle.getChama().getChamaId(), actorId);
        if (!"ACTIVE".equalsIgnoreCase(cycle.getStatus())) {
            throw new IllegalStateException("Only an active cycle can be cancelled");
        }
        if (roscaRosterRepository.findByCycleCycleIdOrderByPositionAsc(cycleId).stream().anyMatch(r -> "PAID".equalsIgnoreCase(r.getStatus()))) {
            throw new IllegalStateException("A payout has already been made in this cycle, so it can't be cancelled");
        }
        cycle.setStatus("CANCELLED");
        roscaCycleRepository.save(cycle);
    }
}
