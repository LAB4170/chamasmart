package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZonedDateTime;
import java.util.*;

/**
 * T-05: loan cover run by the chama itself. A small premium is kept back from each new loan into a reserve that is never lent out.
 * If the borrower dies or is permanently disabled, two different officials can pay what is still owed from that reserve, up to what it holds.
 * No outside insurer is involved, so the reserve is the limit of the cover and members are told so.
 */
@Service
@RequiredArgsConstructor
public class LoanCoverService {
    static final BigDecimal MAX_PERCENT = new BigDecimal("10");
    private static final List<String> OPEN_LOAN = List.of("APPROVED", "DISBURSED", "ACTIVE", "DEFAULTED");

    private final LoanRepository loans;
    private final LoanConfigRepository configs;
    private final LoanCoverClaimRepository claims;
    private final ChamaMemberRepository members;
    private final LoanScheduleService schedule;
    private final FinancialAuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;

    /** Premium for a new loan; zero when the chama has no cover. */
    public static BigDecimal premium(BigDecimal loanAmount, BigDecimal percent) {
        if (loanAmount == null || percent == null || percent.signum() <= 0) return BigDecimal.ZERO;
        return loanAmount.multiply(percent).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    }

    private ChamaMember official(Long chamaId, Long userId) {
        ChamaMember m = members.findByChamaChamaIdAndUserUserId(chamaId, userId).filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new AccessDeniedException("You are not an active member of this chama"));
        if (!MembershipService.isOfficial(m)) throw new AccessDeniedException("Only chama officials can do this");
        return m;
    }

    @Transactional
    public BigDecimal setPercent(Long chamaId, Long officialId, BigDecimal percent) {
        official(chamaId, officialId);
        if (percent == null || percent.signum() < 0 || percent.compareTo(MAX_PERCENT) > 0) throw new IllegalArgumentException("The cover premium must be between 0 and 10 percent");
        LoanConfig cfg = configs.findByChamaId(chamaId).orElseGet(() -> LoanConfig.defaults(chamaId));
        cfg.setCoverPercent(percent.signum() == 0 ? null : percent);
        cfg.setUpdatedAt(ZonedDateTime.now()); cfg.setUpdatedBy(officialId);
        configs.save(cfg);
        return percent;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> overview(Long chamaId, Long userId) {
        members.findByChamaChamaIdAndUserUserId(chamaId, userId).filter(ChamaMember::getIsActive).orElseThrow(() -> new AccessDeniedException("You are not an active member of this chama"));
        BigDecimal pct = configs.findByChamaId(chamaId).map(LoanConfig::getCoverPercent).orElse(null);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("cover_percent", pct == null ? BigDecimal.ZERO : pct);
        out.put("reserve", loans.coverReserve(chamaId));
        out.put("claims", claims.findByChamaIdOrderByCreatedAtDesc(chamaId).stream().map(c -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("claim_id", c.getClaimId()); m.put("loan_id", c.getLoan().getLoanId()); m.put("reason", c.getReason()); m.put("details", c.getDetails());
            m.put("status", c.getStatus()); m.put("amount_paid", c.getAmountPaid()); m.put("decision_note", c.getDecisionNote()); m.put("created_at", c.getCreatedAt());
            return m;
        }).toList());
        return out;
    }

    @Transactional
    public Map<String, Object> request(Long chamaId, Long loanId, Long officialId, String reason, String details) {
        official(chamaId, officialId);
        Loan loan = loans.findByIdWithPessimisticLock(loanId).filter(l -> l.getChama().getChamaId().equals(chamaId)).orElseThrow(() -> new IllegalArgumentException("Loan not found"));
        if (loan.getBorrower().getUserId().equals(officialId)) throw new AccessDeniedException("You cannot claim on your own loan; another official must");
        String r = reason == null ? "" : reason.trim().toUpperCase();
        if (!r.equals("DEATH") && !r.equals("DISABILITY")) throw new IllegalArgumentException("Cover applies to death or permanent disability of the borrower");
        if (details == null || details.trim().length() < 10) throw new IllegalArgumentException("Describe what happened and what evidence the officials have seen");
        if (loan.getCoverPremium() == null || loan.getCoverPremium().signum() <= 0) throw new IllegalStateException("This loan was made without cover");
        if (!OPEN_LOAN.contains(String.valueOf(loan.getStatus()).toUpperCase())) throw new IllegalStateException("Only a loan that is still being repaid can be claimed on");
        if (claims.existsByLoanLoanIdAndStatus(loanId, "PENDING")) throw new IllegalStateException("A claim on this loan is already waiting for a decision");
        LoanCoverClaim c = claims.save(LoanCoverClaim.builder().loan(loan).chamaId(chamaId).reason(r).details(details.trim()).requestedBy(officialId).build());
        audit(officialId, loan, "LOAN_COVER_REQUESTED", BigDecimal.ZERO, "Cover claim (" + r + ") requested on loan " + loanId);
        return Map.of("claim_id", c.getClaimId(), "status", c.getStatus());
    }

    /** A different official decides. A chama with only one eligible official may decide its own request. */
    @Transactional
    public Map<String, Object> decide(Long chamaId, Long claimId, Long officialId, boolean approve, String note) {
        official(chamaId, officialId);
        LoanCoverClaim c = claims.findById(claimId).filter(x -> x.getChamaId().equals(chamaId)).orElseThrow(() -> new IllegalArgumentException("Claim not found"));
        if (!"PENDING".equals(c.getStatus())) throw new IllegalStateException("This claim has already been decided");
        Loan loan = loans.findByIdWithPessimisticLock(c.getLoan().getLoanId()).orElseThrow();
        if (loan.getBorrower().getUserId().equals(officialId)) throw new AccessDeniedException("You cannot decide a claim on your own loan");
        long eligible = members.findByChamaChamaIdAndIsActiveTrue(chamaId).stream().filter(MembershipService::isOfficial)
                .filter(m -> !m.getUser().getUserId().equals(loan.getBorrower().getUserId())).count();
        if (c.getRequestedBy().equals(officialId) && eligible >= 2) throw new AccessDeniedException("You made this request, so a different official must decide it");
        if (!approve) {
            if (note == null || note.trim().length() < 3) throw new IllegalArgumentException("Say why the claim is declined");
            finish(c, officialId, "REJECTED", note.trim(), BigDecimal.ZERO);
            audit(officialId, loan, "LOAN_COVER_REJECTED", BigDecimal.ZERO, "Cover claim declined: " + note.trim());
            return Map.of("status", "REJECTED", "amount_paid", BigDecimal.ZERO);
        }
        BigDecimal paid = loan.getAmountPaid() == null ? BigDecimal.ZERO : loan.getAmountPaid();
        BigDecimal owed = loan.getTotalRepayable().subtract(paid).max(BigDecimal.ZERO);
        BigDecimal reserve = loans.coverReserve(chamaId);
        BigDecimal pay = owed.min(reserve).max(BigDecimal.ZERO).setScale(2, RoundingMode.DOWN);
        if (pay.signum() <= 0) throw new IllegalStateException("The cover reserve is empty, so nothing can be paid. Use the guarantors or a write-off instead");
        schedule.apply(loan, loan.getChama(), pay, officialId);
        loan.setAmountPaid(paid.add(pay));
        loan.setCoverPaid((loan.getCoverPaid() == null ? BigDecimal.ZERO : loan.getCoverPaid()).add(pay));
        loan.setLastPaymentDate(ZonedDateTime.now());
        if (loan.getAmountPaid().compareTo(loan.getTotalRepayable()) >= 0) loan.setStatus("COMPLETED");
        loans.save(loan);
        finish(c, officialId, "APPROVED", note == null ? null : note.trim(), pay);
        audit(officialId, loan, "LOAN_COVER_PAID", pay, "Cover paid KES " + pay.toPlainString() + " of KES " + owed.toPlainString() + " owed on loan " + loan.getLoanId() + (pay.compareTo(owed) < 0 ? ". The reserve did not cover all of it" : ""));
        notificationRepository.save(Notification.builder().user(loan.getBorrower()).title("Loan cover applied")
                .message("KES " + pay.toPlainString() + " of the loan was paid from the chama's cover reserve.").type("LOAN_COVER").entityType("LOAN").entityId(loan.getLoanId()).build());
        return Map.of("status", "APPROVED", "amount_paid", pay, "still_owed", owed.subtract(pay));
    }

    private void finish(LoanCoverClaim c, Long by, String status, String note, BigDecimal paid) {
        c.setStatus(status); c.setDecidedBy(by); c.setDecisionNote(note); c.setAmountPaid(paid); c.setDecidedAt(ZonedDateTime.now());
        claims.save(c);
    }

    private void audit(Long actorId, Loan loan, String type, BigDecimal amount, String text) {
        auditLogRepository.save(FinancialAuditLog.builder().user(userRepository.getReferenceById(actorId)).transactionType(type).amount(amount)
                .chama(loan.getChama()).referenceId(loan.getLoanId()).description(text)
                .ipAddress(com.chamasmart.backend.security.ClientIp.current()).userAgent(com.chamasmart.backend.security.ClientIp.currentUserAgent()).build());
    }
}
