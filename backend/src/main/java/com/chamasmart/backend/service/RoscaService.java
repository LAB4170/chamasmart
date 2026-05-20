package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoscaService {

    private final RoscaCycleRepository roscaCycleRepository;
    private final RoscaRosterRepository roscaRosterRepository;
    private final ChamaRepository chamaRepository;
    private final ChamaMemberRepository chamaMemberRepository;
    private final UserRepository userRepository;
    private final ContributionRepository contributionRepository;
    private final FinancialAuditLogRepository auditLogRepository;

    @Transactional
    public RoscaCycleDto createCycle(RoscaCycleDto dto, Long chamaId) {
        log.info("Creating ROSCA cycle '{}' for chama ID: {}", dto.getCycle_name(), chamaId);
        Chama chama = chamaRepository.findById(chamaId)
                .orElseThrow(() -> new RuntimeException("Chama not found"));

        if (!"ROSCA".equalsIgnoreCase(chama.getChamaType())) {
            throw new RuntimeException("Chama is not configured as a ROSCA / Merry-Go-Round group");
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
    public List<RoscaCycleDto> getCyclesByChamaId(Long chamaId) {
        log.info("Fetching ROSCA cycles for chama ID: {}", chamaId);
        List<RoscaCycle> cycles = roscaCycleRepository.findByChamaChamaId(chamaId);
        
        return cycles.stream().map(cycle -> {
            List<RoscaRoster> roster = roscaRosterRepository.findByCycleCycleIdOrderByPositionAsc(cycle.getCycleId());
            return RoscaCycleDto.fromEntity(cycle, roster);
        }).collect(Collectors.toList());
    }

    @Transactional
    public void processPayout(Long cycleId, Long officerUserId) {
        log.info("Processing ROSCA pot payout for cycle ID: {} by officer ID: {}", cycleId, officerUserId);

        RoscaCycle cycle = roscaCycleRepository.findByIdWithPessimisticLock(cycleId)
                .orElseThrow(() -> new RuntimeException("ROSCA cycle not found"));

        Chama chama = chamaRepository.findByIdWithPessimisticLock(cycle.getChama().getChamaId())
                .orElseThrow(() -> new RuntimeException("Chama not found"));

        // Validate officer rights
        ChamaMember officer = chamaMemberRepository.findByChamaChamaIdAndUserUserId(chama.getChamaId(), officerUserId)
                .filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new RuntimeException("User is not an active member of this Chama"));

        if (!"CHAIRPERSON".equalsIgnoreCase(officer.getRole()) && !"TREASURER".equalsIgnoreCase(officer.getRole()) && !"SECRETARY".equalsIgnoreCase(officer.getRole())) {
            throw new org.springframework.security.access.AccessDeniedException("Lacks official privileges to trigger payout");
        }

        // Fetch roster to find the next active recipient
        List<RoscaRoster> rosterList = roscaRosterRepository.findByCycleCycleIdOrderByPositionAsc(cycleId);
        RoscaRoster nextRecipient = rosterList.stream()
                .filter(r -> "ACTIVE".equalsIgnoreCase(r.getStatus()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("No active roster positions left to pay out in this cycle"));

        // Pot amount is total members * contribution amount
        BigDecimal potAmount = cycle.getContributionAmount().multiply(BigDecimal.valueOf(cycle.getTotalMembers()));

        if (chama.getCurrentFund().compareTo(potAmount) < 0) {
            throw new RuntimeException("Insufficient chama funds to disburse the ROSCA pot. Available: " 
                    + chama.getCurrentFund() + ", Required: " + potAmount);
        }

        // Deduct from Chama treasury
        chama.setCurrentFund(chama.getCurrentFund().subtract(potAmount));
        chamaRepository.save(chama);

        // Update roster entry to PAID
        nextRecipient.setStatus("PAID");
        roscaRosterRepository.save(nextRecipient);

        // Check if this was the last payout in the roster
        boolean hasMoreActive = rosterList.stream()
                .anyMatch(r -> "ACTIVE".equalsIgnoreCase(r.getStatus()) && !r.getRosterId().equals(nextRecipient.getRosterId()));

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
                .ipAddress("127.0.0.1")
                .userAgent("System-Service")
                .build();
        auditLogRepository.save(auditLog);

        log.info("Successfully completed pot payout of KES {} to user: {}", potAmount, recipientFullName);
    }

    @Transactional
    public void makeContribution(Long cycleId, Long userId, BigDecimal amount) {
        log.info("Recording ROSCA cycle contribution. Cycle ID: {}, User ID: {}, Amount: {}", cycleId, userId, amount);

        RoscaCycle cycle = roscaCycleRepository.findByIdWithPessimisticLock(cycleId)
                .orElseThrow(() -> new RuntimeException("ROSCA cycle not found"));

        Chama chama = chamaRepository.findByIdWithPessimisticLock(cycle.getChama().getChamaId())
                .orElseThrow(() -> new RuntimeException("Chama not found"));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        ChamaMember member = chamaMemberRepository.findByChamaChamaIdAndUserUserId(chama.getChamaId(), userId)
                .filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new RuntimeException("User is not an active member of this Chama"));

        // Create contribution record
        Contribution contribution = Contribution.builder()
                .chama(chama)
                .user(user)
                .amount(amount)
                .reference("ROSCA-" + cycleId + "-" + System.currentTimeMillis())
                .status("COMPLETED")
                .contributionType("ROSCA")
                .isDeleted(false)
                .build();
        Contribution savedContribution = contributionRepository.save(contribution);

        // Update member total contributions
        member.setTotalContributions(member.getTotalContributions().add(amount));
        member.setLastContributionDate(ZonedDateTime.now());
        chamaMemberRepository.save(member);

        // Update Chama current fund
        chama.setCurrentFund(chama.getCurrentFund().add(amount));
        chamaRepository.save(chama);

        // Write Financial Audit Log
        FinancialAuditLog auditLog = FinancialAuditLog.builder()
                .user(user)
                .transactionType("ROSCA_CONTRIBUTION")
                .amount(amount)
                .chama(chama)
                .referenceId(savedContribution.getContributionId())
                .description("ROSCA Cycle contribution. Cycle: " + cycle.getCycleName() + ", Ref: " + contribution.getReference())
                .ipAddress("127.0.0.1")
                .userAgent("System-Service")
                .build();
        auditLogRepository.save(auditLog);
    }
}
