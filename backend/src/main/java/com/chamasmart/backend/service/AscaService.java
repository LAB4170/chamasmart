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
import java.util.List;
import java.util.stream.Collectors;
@Service
@RequiredArgsConstructor
@Slf4j
public class AscaService {
    private final AscaCycleRepository ascaCycleRepository;
    private final AscaMemberRepository ascaMemberRepository;
    private final ChamaRepository chamaRepository;
    private final UserRepository userRepository;
    private final ChamaMemberRepository chamaMemberRepository;
    private final FinancialAuditLogRepository auditLogRepository;
    private final LedgerService ledger;
    private final AscaShareRequestRepository shareRequestRepository;
    private final LoanRepository loanRepository;
    @org.springframework.beans.factory.annotation.Value("${app.finance.dual-approval-threshold:10000}")
    private BigDecimal dualApprovalThreshold = BigDecimal.valueOf(10000);

    public record ShareOutcome(AscaCycleDto cycle, boolean pending, Long requestId) {}
    private ChamaMember validateUserMembershipAndActiveStatus(Long chamaId, Long userId) {
        return chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, userId)
                .filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("Security Violation: User ID " + userId + " is not an active member of Chama ID " + chamaId));
    }
    private ChamaMember validateUserIsOfficial(Long chamaId, Long userId) {
        ChamaMember member = validateUserMembershipAndActiveStatus(chamaId, userId);
        if (!"CHAIRPERSON".equalsIgnoreCase(member.getRole()) && !"TREASURER".equalsIgnoreCase(member.getRole())) {
            throw new org.springframework.security.access.AccessDeniedException("Security Violation: User ID " + userId + " lacks official administrative privileges for Chama ID " + chamaId);
        }
        return member;
    }
    @Transactional
    public AscaCycleDto createCycle(AscaCycleDto dto, Long chamaId, Long userId) {
        log.info("Creating ASCA cycle '{}' for chama ID: {} by user ID: {}", dto.getCycle_name(), chamaId, userId);
        validateUserIsOfficial(chamaId, userId);
        if (dto.getCycle_name() == null || dto.getCycle_name().isBlank()) throw new IllegalArgumentException("Give the cycle a name");
        if (dto.getShare_price() != null && dto.getShare_price().signum() <= 0) throw new IllegalArgumentException("The share price must be more than zero");
        if (dto.getTotal_shares() != null && dto.getTotal_shares() <= 0) throw new IllegalArgumentException("The number of shares must be more than zero");
        Chama chama = chamaRepository.findById(chamaId)
                .orElseThrow(() -> new RuntimeException("Chama not found"));
        if (!"ASCA".equalsIgnoreCase(chama.getChamaType())) {
            throw new RuntimeException("Chama is not configured as an ASCA / Accumulating Savings group");
        }
        if (ascaCycleRepository.findByChamaChamaId(chamaId).stream().anyMatch(c -> "ACTIVE".equalsIgnoreCase(c.getStatus()) || "CLOSING".equalsIgnoreCase(c.getStatus()))) {
            throw new IllegalStateException("This chama already has a running cycle. Share it out and close it first");
        }
        AscaCycle cycle = AscaCycle.builder()
                .chama(chama)
                .cycleName(dto.getCycle_name())
                .startDate(dto.getStart_date() != null ? dto.getStart_date() : LocalDate.now())
                .endDate(dto.getEnd_date() != null ? dto.getEnd_date() : LocalDate.now().plusYears(1))
                .sharePrice(dto.getShare_price() != null ? dto.getShare_price() : BigDecimal.valueOf(1000.0))
                .totalShares(dto.getTotal_shares() != null ? dto.getTotal_shares() : 1000)
                .availableShares(dto.getTotal_shares() != null ? dto.getTotal_shares() : 1000)
                .dividendRate(BigDecimal.ZERO) // A-02: no promised rate. Members get their share of what the cycle actually earned at share-out
                .status("ACTIVE")
                .build();
        AscaCycle savedCycle = ascaCycleRepository.save(cycle);
        log.info("Successfully created ASCA cycle ID: {}", savedCycle.getCycleId());
        List<AscaMember> members = ascaMemberRepository.findByCycleCycleId(savedCycle.getCycleId());
        return AscaCycleDto.fromEntity(savedCycle, members);
    }
    @Transactional
    public ShareOutcome purchaseShares(Long cycleId, Long actorId, Long userId, Integer sharesToPurchase) {
        if (sharesToPurchase == null || sharesToPurchase <= 0) throw new IllegalArgumentException("Enter a number of shares above zero");
        log.info("Processing share purchase of {} shares by user ID: {} in cycle ID: {}", sharesToPurchase, userId, cycleId);
        AscaCycle cycle = ascaCycleRepository.findByIdWithPessimisticLock(cycleId)
                .orElseThrow(() -> new RuntimeException("ASCA cycle not found"));
        Chama chama = chamaRepository.findByIdWithPessimisticLock(cycle.getChama().getChamaId())
                .orElseThrow(() -> new RuntimeException("Chama not found"));
        // Shares are only recorded by an official once payment has actually been received.
        validateUserIsOfficial(chama.getChamaId(), actorId);
        validateUserMembershipAndActiveStatus(chama.getChamaId(), userId);
        if (actorId.equals(userId)) {
            throw new org.springframework.security.access.AccessDeniedException("You cannot record shares for yourself; another official must do it");
        }
        if (!"ACTIVE".equals(cycle.getStatus())) {
            throw new RuntimeException("Cannot purchase shares in an inactive cycle");
        }
        if (cycle.getAvailableShares() < sharesToPurchase) {
            throw new RuntimeException("Not enough available shares in this cycle. Available: " + cycle.getAvailableShares());
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        BigDecimal investmentAmount = cycle.getSharePrice().multiply(BigDecimal.valueOf(sharesToPurchase));
        // Large purchases are only requested here; a different official confirms the money arrived before shares are issued.
        if (investmentAmount.compareTo(dualApprovalThreshold) >= 0) {
            AscaShareRequest req = shareRequestRepository.save(AscaShareRequest.builder()
                    .cycle(cycle).user(user).shares(sharesToPurchase).amount(investmentAmount).status("PENDING").requestedBy(actorId).build());
            auditLogRepository.save(FinancialAuditLog.builder().user(userRepository.getReferenceById(actorId)).transactionType("ASCA_SHARE_REQUESTED")
                    .amount(investmentAmount).chama(chama).referenceId(req.getRequestId())
                    .description(sharesToPurchase + " shares requested for member " + userId + ". A different official must confirm the payment")
                    .ipAddress(com.chamasmart.backend.security.ClientIp.current()).userAgent(com.chamasmart.backend.security.ClientIp.currentUserAgent()).build());
            return new ShareOutcome(AscaCycleDto.fromEntity(cycle, ascaMemberRepository.findByCycleCycleId(cycle.getCycleId())), true, req.getRequestId());
        }
        return new ShareOutcome(issueShares(cycle, chama, user, sharesToPurchase, investmentAmount, actorId), false, null);
    }

    private AscaCycleDto issueShares(AscaCycle cycle, Chama chama, User user, Integer sharesToPurchase, BigDecimal investmentAmount, Long actorId) {
        Long userId = user.getUserId();
        AscaMember member = ascaMemberRepository.findByCycleCycleIdAndUserUserId(cycle.getCycleId(), userId)
                .orElse(AscaMember.builder()
                        .cycle(cycle)
                        .user(user)
                        .sharesOwned(0)
                        .totalInvestment(BigDecimal.ZERO)
                        .dividendsEarned(BigDecimal.ZERO)
                        .status("ACTIVE")
                        .build());
        member.setSharesOwned(member.getSharesOwned() + sharesToPurchase);
        member.setTotalInvestment(member.getTotalInvestment().add(investmentAmount));
        ascaMemberRepository.save(member);
        cycle.setAvailableShares(cycle.getAvailableShares() - sharesToPurchase);
        AscaCycle updatedCycle = ascaCycleRepository.save(cycle);
        // Credit the investment amount to the Chama's current fund balance
        chama.setCurrentFund(chama.getCurrentFund().add(investmentAmount));
        chamaRepository.save(chama);
        ledger.post(chama, LedgerEntry.CHAMA_FUND, investmentAmount, "ASCA_SHARE_PURCHASE", "ASCA_CYCLE", cycle.getCycleId(), actorId, sharesToPurchase + " shares for member " + userId);
        // Record Financial Audit Log
        FinancialAuditLog auditLog = FinancialAuditLog.builder()
                .user(user)
                .transactionType("ASCA_SHARE_PURCHASE")
                .amount(investmentAmount)
                .chama(chama)
                .referenceId(cycle.getCycleId())
                .description("ASCA shares purchased: " + sharesToPurchase + " shares. Total Invested: KES " + investmentAmount)
                .ipAddress(com.chamasmart.backend.security.ClientIp.current())
                .userAgent(com.chamasmart.backend.security.ClientIp.currentUserAgent())
                .build();
        auditLogRepository.save(auditLog);
        log.info("Successfully processed share purchase. Remaining available shares: {}", updatedCycle.getAvailableShares());
        List<AscaMember> members = ascaMemberRepository.findByCycleCycleId(updatedCycle.getCycleId());
        return AscaCycleDto.fromEntity(updatedCycle, members);
    }
    @Transactional(readOnly = true)
    public List<AscaCycleDto> getCyclesByChamaId(Long chamaId, Long actorId) {
        validateUserMembershipAndActiveStatus(chamaId, actorId);
        log.info("Fetching ASCA cycles for chama ID: {}", chamaId);
        List<AscaCycle> cycles = ascaCycleRepository.findByChamaChamaId(chamaId);
        return cycles.stream().map(cycle -> {
            List<AscaMember> members = ascaMemberRepository.findByCycleCycleId(cycle.getCycleId());
            return AscaCycleDto.fromEntity(cycle, members);
        }).collect(Collectors.toList());
    }

    @Transactional
    public AscaCycleDto verifyShareRequest(Long requestId, Long officialId) {
        AscaShareRequest req = shareRequestRepository.findById(requestId).orElseThrow(() -> new RuntimeException("Share request not found"));
        AscaCycle cycle = ascaCycleRepository.findByIdWithPessimisticLock(req.getCycle().getCycleId()).orElseThrow(() -> new RuntimeException("ASCA cycle not found"));
        Chama chama = chamaRepository.findByIdWithPessimisticLock(cycle.getChama().getChamaId()).orElseThrow(() -> new RuntimeException("Chama not found"));
        validateUserIsOfficial(chama.getChamaId(), officialId);
        if (officialId.equals(req.getRequestedBy()) || officialId.equals(req.getUser().getUserId())) {
            throw new org.springframework.security.access.AccessDeniedException("A different official must verify this share purchase");
        }
        if (!"PENDING".equals(req.getStatus())) throw new IllegalStateException("This request has already been " + String.valueOf(req.getStatus()).toLowerCase());
        if (!"ACTIVE".equals(cycle.getStatus())) throw new IllegalStateException("The cycle is no longer active");
        if (cycle.getAvailableShares() < req.getShares()) throw new IllegalStateException("Not enough shares are left. Available: " + cycle.getAvailableShares());
        AscaCycleDto out = issueShares(cycle, chama, req.getUser(), req.getShares(), req.getAmount(), officialId);
        req.setStatus("VERIFIED");
        req.setDecidedBy(officialId);
        req.setDecidedAt(java.time.ZonedDateTime.now());
        shareRequestRepository.save(req);
        return out;
    }

    @Transactional
    public void rejectShareRequest(Long requestId, Long officialId) {
        AscaShareRequest req = shareRequestRepository.findById(requestId).orElseThrow(() -> new RuntimeException("Share request not found"));
        validateUserIsOfficial(req.getCycle().getChama().getChamaId(), officialId);
        if (!"PENDING".equals(req.getStatus())) throw new IllegalStateException("This request has already been " + String.valueOf(req.getStatus()).toLowerCase());
        req.setStatus("REJECTED");
        req.setDecidedBy(officialId);
        req.setDecidedAt(java.time.ZonedDateTime.now());
        shareRequestRepository.save(req);
    }

    @Transactional(readOnly = true)
    public List<java.util.Map<String, Object>> pendingShareRequests(Long cycleId, Long officialId) {
        AscaCycle cycle = ascaCycleRepository.findById(cycleId).orElseThrow(() -> new RuntimeException("ASCA cycle not found"));
        validateUserIsOfficial(cycle.getChama().getChamaId(), officialId);
        return shareRequestRepository.findByCycleId(cycleId).stream().filter(r -> "PENDING".equals(r.getStatus())).map(r -> {
            java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("request_id", r.getRequestId()); m.put("user_id", r.getUser().getUserId());
            m.put("member_name", (r.getUser().getFirstName() + " " + r.getUser().getLastName()).trim());
            m.put("shares", r.getShares()); m.put("amount", r.getAmount()); m.put("requested_by", r.getRequestedBy()); m.put("created_at", r.getCreatedAt());
            return m;
        }).collect(Collectors.toList());
    }
    private static final List<String> OPEN_LOAN = List.of("PENDING", "APPROVED", "DISBURSED", "ACTIVE", "DEFAULTED");

    /** A-03: what each member would receive if the cycle closed now. Pool = the chama's cash; shares decide the split. */
    @Transactional(readOnly = true)
    public java.util.Map<String, Object> shareOutPreview(Long cycleId, Long officialId) {
        AscaCycle cycle = ascaCycleRepository.findById(cycleId).orElseThrow(() -> new RuntimeException("ASCA cycle not found"));
        validateUserIsOfficial(cycle.getChama().getChamaId(), officialId);
        Chama chama = chamaRepository.findById(cycle.getChama().getChamaId()).orElseThrow(() -> new RuntimeException("Chama not found"));
        return buildShareOut(cycle, chama);
    }

    private java.util.Map<String, Object> buildShareOut(AscaCycle cycle, Chama chama) {
        List<AscaMember> members = ascaMemberRepository.findByCycleCycleId(cycle.getCycleId());
        int issued = members.stream().mapToInt(m -> m.getSharesOwned() == null ? 0 : m.getSharesOwned()).sum();
        BigDecimal pool = chama.getCurrentFund() == null ? BigDecimal.ZERO : chama.getCurrentFund();
        List<String> blockers = new java.util.ArrayList<>();
        long openLoans = loanRepository.findByChamaChamaId(chama.getChamaId()).stream().filter(l -> OPEN_LOAN.contains(String.valueOf(l.getStatus()).toUpperCase())).count();
        if (openLoans > 0) blockers.add(openLoans + " loan(s) are not settled yet. Cash from them must come back before sharing out");
        long pendingShares = shareRequestRepository.findByCycleId(cycle.getCycleId()).stream().filter(r -> "PENDING".equals(r.getStatus())).count();
        if (pendingShares > 0) blockers.add(pendingShares + " share purchase request(s) are still waiting for verification");
        if (issued == 0) blockers.add("No shares have been issued in this cycle");
        if (!"ACTIVE".equalsIgnoreCase(cycle.getStatus()) && !"CLOSING".equalsIgnoreCase(cycle.getStatus())) blockers.add("This cycle is " + String.valueOf(cycle.getStatus()).toLowerCase());
        List<java.util.Map<String, Object>> rows = new java.util.ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (AscaMember m : members) {
            BigDecimal amount = issued == 0 ? BigDecimal.ZERO : pool.multiply(BigDecimal.valueOf(m.getSharesOwned())).divide(BigDecimal.valueOf(issued), 2, java.math.RoundingMode.DOWN);
            total = total.add(amount);
            java.util.Map<String, Object> r = new java.util.LinkedHashMap<>();
            r.put("user_id", m.getUser().getUserId());
            r.put("member_name", (m.getUser().getFirstName() + " " + m.getUser().getLastName()).trim());
            r.put("shares", m.getSharesOwned());
            r.put("invested", m.getTotalInvestment());
            r.put("amount", amount);
            r.put("gain", amount.subtract(m.getTotalInvestment() == null ? BigDecimal.ZERO : m.getTotalInvestment()));
            rows.add(r);
        }
        java.util.Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("cycle_id", cycle.getCycleId());
        out.put("status", cycle.getStatus());
        out.put("pool", pool);
        out.put("shares_issued", issued);
        out.put("total_payout", total);
        out.put("left_in_fund", pool.subtract(total));
        out.put("members", rows);
        out.put("blockers", blockers);
        out.put("can_close", blockers.isEmpty());
        out.put("close_requested_by", cycle.getCloseRequestedBy());
        return out;
    }

    /**
     * Closing a cycle shares out the chama's cash by shares. One official requests, a different one confirms.
     * If fewer than two officials exist, one may proceed and the audit row says so. Returns AWAITING_SECOND_OFFICIAL or CLOSED.
     */
    @Transactional
    public String closeCycle(Long cycleId, Long officialId) {
        AscaCycle cycle = ascaCycleRepository.findByIdWithPessimisticLock(cycleId).orElseThrow(() -> new RuntimeException("ASCA cycle not found"));
        Chama chama = chamaRepository.findByIdWithPessimisticLock(cycle.getChama().getChamaId()).orElseThrow(() -> new RuntimeException("Chama not found"));
        validateUserIsOfficial(chama.getChamaId(), officialId);
        java.util.Map<String, Object> preview = buildShareOut(cycle, chama);
        @SuppressWarnings("unchecked") List<String> blockers = (List<String>) preview.get("blockers");
        if (!blockers.isEmpty()) throw new IllegalStateException(String.join(". ", blockers));
        long officials = chamaMemberRepository.findByChamaChamaIdAndIsActiveTrue(chama.getChamaId()).stream()
                .filter(m -> m.getRole() != null && List.of("CHAIRPERSON", "TREASURER").contains(m.getRole().toUpperCase())).count();
        if (officials >= 2) {
            if (cycle.getCloseRequestedBy() == null) {
                cycle.setCloseRequestedBy(officialId);
                cycle.setStatus("CLOSING");
                ascaCycleRepository.save(cycle);
                auditLogRepository.save(FinancialAuditLog.builder().user(userRepository.getReferenceById(officialId)).transactionType("ASCA_CLOSE_REQUESTED")
                        .amount((BigDecimal) preview.get("total_payout")).chama(chama).referenceId(cycleId)
                        .description("Share-out requested. A different official must confirm it")
                        .ipAddress(com.chamasmart.backend.security.ClientIp.current()).userAgent(com.chamasmart.backend.security.ClientIp.currentUserAgent()).build());
                return "AWAITING_SECOND_OFFICIAL";
            }
            if (cycle.getCloseRequestedBy().equals(officialId)) {
                throw new org.springframework.security.access.AccessDeniedException("You requested this share-out, so a different official must confirm it");
            }
        }
        BigDecimal total = (BigDecimal) preview.get("total_payout");
        if (total.compareTo(chama.getCurrentFund()) > 0) throw new IllegalStateException("The fund cannot cover this share-out");
        List<AscaMember> members = ascaMemberRepository.findByCycleCycleId(cycleId);
        for (AscaMember m : members) {
            BigDecimal amount = (BigDecimal) ((java.util.Map<?, ?>) ((List<?>) preview.get("members")).stream()
                    .filter(r -> ((java.util.Map<?, ?>) r).get("user_id").equals(m.getUser().getUserId())).findFirst().orElseThrow()).get("amount");
            m.setPayoutAmount(amount);
            m.setPaidOutAt(java.time.ZonedDateTime.now());
            m.setDividendsEarned(amount.subtract(m.getTotalInvestment() == null ? BigDecimal.ZERO : m.getTotalInvestment()));
            m.setStatus("SETTLED");
            ascaMemberRepository.save(m);
            auditLogRepository.save(FinancialAuditLog.builder().user(m.getUser()).transactionType("ASCA_SHARE_OUT").amount(amount).chama(chama).referenceId(cycleId)
                    .description("Share-out: " + m.getSharesOwned() + " shares, KES " + amount.toPlainString() + " (invested KES " + (m.getTotalInvestment() == null ? "0" : m.getTotalInvestment().toPlainString()) + "). Released by official " + officialId)
                    .ipAddress(com.chamasmart.backend.security.ClientIp.current()).userAgent(com.chamasmart.backend.security.ClientIp.currentUserAgent()).build());
        }
        chama.setCurrentFund(chama.getCurrentFund().subtract(total));
        chamaRepository.save(chama);
        ledger.post(chama, LedgerEntry.CHAMA_FUND, total.negate(), "ASCA_SHARE_OUT", "ASCA_CYCLE", cycleId, officialId, "Cycle share-out");
        cycle.setStatus("COMPLETED");
        cycle.setCloseRequestedBy(null);
        ascaCycleRepository.save(cycle);
        return "CLOSED";
    }

    /** Withdraws a pending close request so the cycle can carry on. Any official may do it. */
    @Transactional
    public void cancelCloseRequest(Long cycleId, Long officialId) {
        AscaCycle cycle = ascaCycleRepository.findByIdWithPessimisticLock(cycleId).orElseThrow(() -> new RuntimeException("ASCA cycle not found"));
        validateUserIsOfficial(cycle.getChama().getChamaId(), officialId);
        if (!"CLOSING".equalsIgnoreCase(cycle.getStatus())) throw new IllegalStateException("No share-out has been requested");
        cycle.setStatus("ACTIVE");
        cycle.setCloseRequestedBy(null);
        ascaCycleRepository.save(cycle);
    }
}
