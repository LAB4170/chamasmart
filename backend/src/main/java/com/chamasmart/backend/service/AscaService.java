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
        if (dto.getDividend_rate() != null && (dto.getDividend_rate().signum() < 0 || dto.getDividend_rate().compareTo(BigDecimal.valueOf(100)) > 0)) throw new IllegalArgumentException("The dividend rate must be between 0 and 100");
        Chama chama = chamaRepository.findById(chamaId)
                .orElseThrow(() -> new RuntimeException("Chama not found"));
        if (!"ASCA".equalsIgnoreCase(chama.getChamaType())) {
            throw new RuntimeException("Chama is not configured as an ASCA / Accumulating Savings group");
        }
        AscaCycle cycle = AscaCycle.builder()
                .chama(chama)
                .cycleName(dto.getCycle_name())
                .startDate(dto.getStart_date() != null ? dto.getStart_date() : LocalDate.now())
                .endDate(dto.getEnd_date() != null ? dto.getEnd_date() : LocalDate.now().plusYears(1))
                .sharePrice(dto.getShare_price() != null ? dto.getShare_price() : BigDecimal.valueOf(1000.0))
                .totalShares(dto.getTotal_shares() != null ? dto.getTotal_shares() : 1000)
                .availableShares(dto.getTotal_shares() != null ? dto.getTotal_shares() : 1000)
                .dividendRate(dto.getDividend_rate() != null ? dto.getDividend_rate() : BigDecimal.valueOf(5.0))
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
}
