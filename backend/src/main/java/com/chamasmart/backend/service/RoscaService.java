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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    private final RoscaSwapRepository swapRepository;
    private final NotificationRepository notificationRepository;
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
        List<ChamaMember> activeMembers = orderMembers(chamaMemberRepository.findByChamaChamaIdAndIsActiveTrue(chamaId), dto);
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
                .payoutOrder(orderMode(dto))
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
    private static String orderMode(RoscaCycleDto dto) {
        String mode = dto.getPayout_order() == null || dto.getPayout_order().isBlank() ? "ROTATIONAL" : dto.getPayout_order().trim().toUpperCase();
        if (!List.of("ROTATIONAL", "RANDOM", "MANUAL").contains(mode))
            throw new IllegalArgumentException("Payout order must be ROTATIONAL (order of joining), RANDOM (a draw) or MANUAL (you choose)");
        return mode;
    }

    /**
     * R-05: turns are given in the order of joining, by a random draw, or in an order the officials choose. The draw uses a secure
     * random source, and the mode used is stored with the cycle so members can see how the order was set.
     */
    List<ChamaMember> orderMembers(List<ChamaMember> members, RoscaCycleDto dto) {
        String mode = orderMode(dto);
        List<ChamaMember> list = new ArrayList<>(members);
        switch (mode) {
            case "RANDOM" -> java.util.Collections.shuffle(list, new java.security.SecureRandom());
            case "MANUAL" -> {
                List<Long> wanted = dto.getMember_order();
                if (wanted == null || wanted.size() != list.size() || new java.util.HashSet<>(wanted).size() != wanted.size())
                    throw new IllegalArgumentException("Choose a turn for every member, once each");
                Map<Long, ChamaMember> byId = list.stream().collect(Collectors.toMap(m -> m.getUser().getUserId(), m -> m, (a, b) -> a));
                List<ChamaMember> ordered = new ArrayList<>();
                for (Long id : wanted) {
                    ChamaMember m = byId.get(id);
                    if (m == null) throw new IllegalArgumentException("Someone in the list is not an active member of this chama");
                    ordered.add(m);
                }
                list = ordered;
            }
            default -> list.sort(java.util.Comparator.comparing(ChamaMember::getJoinDate, java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()))
                    .thenComparing(m -> m.getUser().getUserId()));
        }
        return list;
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
        if (!com.chamasmart.backend.security.RolePolicy.isOfficial(officer.getRole())) {
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
        // R-01: the pot comes from money collected for this cycle, not from the chama's shared fund.
        Map<String, Object> round = roundSummary(cycle, rosterList);
        BigDecimal available = (BigDecimal) round.get("available");
        if (available.compareTo(potAmount) < 0) {
            throw new IllegalStateException("Only KES " + available.toPlainString() + " has been collected for this round and the pot is KES " + potAmount.toPlainString()
                    + ". Still to pay: " + round.get("behind_names") + ". Record or verify their payments first");
        }
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
        nextRecipient.setPaidAt(ZonedDateTime.now());
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

    /** What has been collected for a cycle (verified, not reversed), counting old rows that only carry the text tag. */
    private BigDecimal collected(RoscaCycle cycle, Long userId) {
        String tag = "[cycle:" + cycle.getCycleId() + "]";
        return contributionRepository.findByChamaChamaIdAndIsDeletedFalse(cycle.getChama().getChamaId()).stream()
                .filter(c -> "ROSCA".equalsIgnoreCase(c.getContributionType()) && "COMPLETED".equalsIgnoreCase(c.getStatus()))
                .filter(c -> cycle.getCycleId().equals(c.getCycleId()) || (c.getCycleId() == null && c.getNotes() != null && c.getNotes().startsWith(tag)))
                .filter(c -> userId == null || c.getUser().getUserId().equals(userId))
                .map(Contribution::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** R-02: the current round, what is in the pot, and who is behind. */
    private Map<String, Object> roundSummary(RoscaCycle cycle, List<RoscaRoster> roster) {
        BigDecimal each = cycle.getContributionAmount();
        BigDecimal pot = each.multiply(BigDecimal.valueOf(cycle.getTotalMembers()));
        long paidRounds = roster.stream().filter(r -> "PAID".equalsIgnoreCase(r.getStatus())).count();
        long round = Math.min(paidRounds + 1, cycle.getTotalMembers());
        BigDecimal collected = collected(cycle, null);
        BigDecimal available = collected.subtract(pot.multiply(BigDecimal.valueOf(paidRounds))).max(BigDecimal.ZERO);
        BigDecimal expectedEach = each.multiply(BigDecimal.valueOf(round));
        List<Map<String, Object>> members = new ArrayList<>();
        List<String> behind = new ArrayList<>();
        for (RoscaRoster r : roster) {
            if ("SKIPPED".equalsIgnoreCase(r.getStatus())) continue;
            BigDecimal paid = collected(cycle, r.getUser().getUserId());
            BigDecimal owed = expectedEach.subtract(paid).max(BigDecimal.ZERO);
            String name = r.getUser().getFirstName() + " " + r.getUser().getLastName();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("user_id", r.getUser().getUserId());
            row.put("member_name", name);
            row.put("paid", paid);
            row.put("expected", expectedEach);
            row.put("arrears", owed);
            members.add(row);
            if (owed.signum() > 0) behind.add(name);
        }
        RoscaRoster current = roster.stream().filter(r -> "ACTIVE".equalsIgnoreCase(r.getStatus()) || "PAYOUT_PENDING".equalsIgnoreCase(r.getStatus())).findFirst().orElse(null);
        Map<String, Object> out = new LinkedHashMap<>();
        if (current != null) {
            out.put("recipient_name", current.getUser().getFirstName() + " " + current.getUser().getLastName());
            out.put("due_date", current.getPayoutDate());
            long late = current.getPayoutDate() == null ? 0 : java.time.temporal.ChronoUnit.DAYS.between(current.getPayoutDate(), LocalDate.now());
            out.put("days_overdue", Math.max(late, 0));
        }
        // R-07: people who joined after the cycle began wait for the next cycle; the pot and the order do not change mid-cycle.
        Set<Long> inRoster = roster.stream().map(r -> r.getUser().getUserId()).collect(Collectors.toSet());
        out.put("waiting_for_next_cycle", chamaMemberRepository.findByChamaChamaIdAndIsActiveTrue(cycle.getChama().getChamaId()).stream()
                .filter(m -> !inRoster.contains(m.getUser().getUserId())).map(m -> m.getUser().getFirstName() + " " + m.getUser().getLastName()).toList());
        out.put("round_number", round);
        out.put("total_rounds", cycle.getTotalMembers());
        out.put("pot", pot);
        out.put("collected", collected);
        out.put("available", available);
        out.put("ready", available.compareTo(pot) >= 0);
        out.put("members", members);
        out.put("behind_names", behind.isEmpty() ? "nobody" : String.join(", ", behind));
        return out;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getRound(Long cycleId, Long actorId) {
        RoscaCycle cycle = requireCycle(cycleId, null);
        membershipService.activeMember(cycle.getChama().getChamaId(), actorId);
        return roundSummary(cycle, roscaRosterRepository.findByCycleCycleIdOrderByPositionAsc(cycleId));
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

    // ---- R-05: swapping turns ----

    private RoscaRoster slot(Long cycleId, Long userId) {
        return roscaRosterRepository.findByCycleCycleIdAndUserUserId(cycleId, userId)
                .orElseThrow(() -> new IllegalArgumentException("That person is not in this cycle"));
    }

    private static void requireSwappable(RoscaRoster r, String who) {
        if (!"ACTIVE".equalsIgnoreCase(r.getStatus()))
            throw new IllegalStateException(who + " already has a turn that is paid, pending or skipped, so it cannot be swapped");
    }

    @Transactional
    public RoscaSwap requestSwap(Long cycleId, Long requesterId, Long targetId, String reason) {
        RoscaCycle cycle = requireCycle(cycleId, null);
        membershipService.activeMember(cycle.getChama().getChamaId(), requesterId);
        if (!"ACTIVE".equalsIgnoreCase(cycle.getStatus())) throw new IllegalStateException("This cycle is not active");
        if (requesterId.equals(targetId)) throw new IllegalArgumentException("Choose another member to swap with");
        requireSwappable(slot(cycleId, requesterId), "You");
        requireSwappable(slot(cycleId, targetId), "That member");
        boolean busy = swapRepository.findByCycleCycleIdAndStatus(cycleId, "PENDING").stream().anyMatch(s ->
                List.of(requesterId, targetId).contains(s.getRequester().getUserId()) || List.of(requesterId, targetId).contains(s.getTarget().getUserId()));
        if (busy) throw new IllegalStateException("One of you already has a swap waiting for an answer");
        RoscaSwap swap = swapRepository.save(RoscaSwap.builder().cycle(cycle).requester(userRepository.getReferenceById(requesterId))
                .target(userRepository.getReferenceById(targetId)).status("PENDING")
                .reason(reason == null || reason.isBlank() ? null : reason.trim().substring(0, Math.min(300, reason.trim().length()))).build());
        notificationRepository.save(Notification.builder().user(userRepository.getReferenceById(targetId)).title("Swap request")
                .message("A member asked to swap payout turns with you in " + cycle.getCycleName() + ". Open the cycle to accept or decline.")
                .type("ROSCA_SWAP").entityType("ROSCA_SWAP").entityId(swap.getSwapId()).build());
        return swap;
    }

    /** Only the member who was asked can answer. If they accept, the two turns and their dates trade places. */
    @Transactional
    public RoscaSwap respondToSwap(Long swapId, Long userId, boolean accept) {
        RoscaSwap swap = swapRepository.findById(swapId).orElseThrow(() -> new IllegalArgumentException("Swap request not found"));
        if (!"PENDING".equals(swap.getStatus())) throw new IllegalStateException("This request has already been answered");
        if (!swap.getTarget().getUserId().equals(userId)) throw new org.springframework.security.access.AccessDeniedException("Only the member who was asked can answer");
        RoscaCycle cycle = roscaCycleRepository.findByIdWithPessimisticLock(swap.getCycle().getCycleId()).orElseThrow();
        Long chamaId = cycle.getChama().getChamaId();
        if (accept) {
            if (!"ACTIVE".equalsIgnoreCase(cycle.getStatus())) throw new IllegalStateException("This cycle is no longer active");
            RoscaRoster a = slot(cycle.getCycleId(), swap.getRequester().getUserId());
            RoscaRoster b = slot(cycle.getCycleId(), userId);
            requireSwappable(a, swap.getRequester().getFirstName());
            requireSwappable(b, "You");
            int posA = a.getPosition(), posB = b.getPosition();
            LocalDate dateA = a.getPayoutDate(), dateB = b.getPayoutDate();
            // (cycle, position) is unique, so park one row on a free number before the two turns trade places.
            a.setPosition(-1);
            roscaRosterRepository.saveAndFlush(a);
            b.setPosition(posA); b.setPayoutDate(dateA);
            roscaRosterRepository.saveAndFlush(b);
            a.setPosition(posB); a.setPayoutDate(dateB);
            roscaRosterRepository.saveAndFlush(a);
            auditLogRepository.save(FinancialAuditLog.builder().user(userRepository.getReferenceById(userId)).transactionType("ROSCA_TURNS_SWAPPED")
                    .chama(cycle.getChama()).referenceId(cycle.getCycleId())
                    .description("Turns swapped: positions " + a.getPosition() + " and " + b.getPosition() + " in " + cycle.getCycleName()).build());
        }
        swap.setStatus(accept ? "ACCEPTED" : "DECLINED");
        swap.setRespondedAt(ZonedDateTime.now());
        swapRepository.save(swap);
        notificationRepository.save(Notification.builder().user(swap.getRequester()).title(accept ? "Swap accepted" : "Swap declined")
                .message(accept ? "Your turns in " + cycle.getCycleName() + " have been swapped." : "Your swap request in " + cycle.getCycleName() + " was declined.")
                .type("ROSCA_SWAP").entityType("ROSCA_SWAP").entityId(swapId).build());
        return swap;
    }

    @Transactional
    public RoscaSwap cancelSwap(Long swapId, Long userId) {
        RoscaSwap swap = swapRepository.findById(swapId).orElseThrow(() -> new IllegalArgumentException("Swap request not found"));
        if (!"PENDING".equals(swap.getStatus())) throw new IllegalStateException("This request has already been answered");
        if (!swap.getRequester().getUserId().equals(userId)) throw new org.springframework.security.access.AccessDeniedException("Only the member who asked can cancel");
        swap.setStatus("CANCELLED");
        swap.setRespondedAt(ZonedDateTime.now());
        return swapRepository.save(swap);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> mySwaps(Long userId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (RoscaSwap s : swapRepository.findByRequesterUserIdOrTargetUserIdOrderByCreatedAtDesc(userId, userId)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("swap_id", s.getSwapId());
            m.put("cycle_id", s.getCycle().getCycleId());
            m.put("chama_id", s.getCycle().getChama().getChamaId());
            m.put("cycle_name", s.getCycle().getCycleName());
            m.put("requester_id", s.getRequester().getUserId());
            m.put("requester_name", s.getRequester().getFirstName() + " " + s.getRequester().getLastName());
            m.put("target_id", s.getTarget().getUserId());
            m.put("target_name", s.getTarget().getFirstName() + " " + s.getTarget().getLastName());
            m.put("status", s.getStatus());
            m.put("reason", s.getReason());
            m.put("created_at", s.getCreatedAt());
            out.add(m);
        }
        return out;
    }

    // ---- R-06: round deadlines ----

    /** Tells the officials once a day when a round's payout date has passed and the recipient has not been paid. */
    @org.springframework.scheduling.annotation.Scheduled(cron = "0 0 7 * * *", zone = "Africa/Nairobi")
    @Transactional
    public void remindOverdueRounds() {
        for (RoscaCycle cycle : roscaCycleRepository.findByStatus("ACTIVE")) {
            List<RoscaRoster> roster = roscaRosterRepository.findByCycleCycleIdOrderByPositionAsc(cycle.getCycleId());
            RoscaRoster current = roster.stream().filter(r -> "ACTIVE".equalsIgnoreCase(r.getStatus()) || "PAYOUT_PENDING".equalsIgnoreCase(r.getStatus())).findFirst().orElse(null);
            if (current == null || current.getPayoutDate() == null || !current.getPayoutDate().isBefore(LocalDate.now())) continue;
            long days = java.time.temporal.ChronoUnit.DAYS.between(current.getPayoutDate(), LocalDate.now());
            Map<String, Object> round = roundSummary(cycle, roster);
            String why = Boolean.TRUE.equals(round.get("ready")) ? "The pot is ready to be paid." : "Still to pay: " + round.get("behind_names") + ".";
            for (ChamaMember o : chamaMemberRepository.findByChamaChamaIdAndIsActiveTrue(cycle.getChama().getChamaId())) {
                if (!MembershipService.isOfficial(o)) continue;
                notificationRepository.save(Notification.builder().user(o.getUser()).title("Merry-go-round round overdue")
                        .message(current.getUser().getFirstName() + "'s turn in " + cycle.getCycleName() + " was due " + days + " day(s) ago. " + why)
                        .type("ROSCA_OVERDUE").entityType("ROSCA_CYCLE").entityId(cycle.getCycleId()).build());
            }
        }
    }
}
