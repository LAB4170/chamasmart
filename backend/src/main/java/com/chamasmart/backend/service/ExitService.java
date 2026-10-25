package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * Leaving a chama or being removed from it, with a refund of the member's savings.
 * The member (or an official, for a removal) starts it. One official approves. A second official pays it out.
 * Nobody approves or pays their own exit. The member stays in the chama until the refund is paid.
 */
@Service
@RequiredArgsConstructor
public class ExitService {
    private static final List<String> OPEN_LOAN = List.of("PENDING", "APPROVED", "DISBURSED", "ACTIVE", "DEFAULTED");
    public static final List<String> OPEN = List.of("REQUESTED", "APPROVED");

    private final MemberExitRepository exitRepo;
    private final ChamaRepository chamaRepo;
    private final ChamaMemberRepository memberRepo;
    private final ContributionRepository contributionRepo;
    private final LoanRepository loanRepo;
    private final LoanGuarantorRepository guarantorRepo;
    private final RoscaCycleRepository roscaRepo;
    private final AscaCycleRepository ascaCycleRepo;
    private final AscaMemberRepository ascaMemberRepo;
    private final FinancialAuditLogRepository auditRepo;
    private final NotificationRepository notifRepo;
    private final LedgerService ledger;
    private final MembershipService membership;
    private final UserRepository userRepo;
    private final FineService fineService;

    BigDecimal savings(Long chamaId, Long userId) {
        return contributionRepo.findByUserUserIdAndIsDeletedFalse(userId).stream()
                .filter(c -> c.getChama() != null && chamaId.equals(c.getChama().getChamaId()))
                .filter(c -> "COMPLETED".equalsIgnoreCase(c.getStatus()))
                .filter(c -> c.getContributionType() == null || "REGULAR".equalsIgnoreCase(c.getContributionType()))
                .map(Contribution::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    /** Fines taken from the savings on exit: all open fines, but never more than the savings. */
    BigDecimal finesTaken(Long chamaId, Long userId, BigDecimal savings) {
        return fineService.outstandingFor(chamaId, userId).min(savings).max(BigDecimal.ZERO);
    }

    BigDecimal netRefund(Long chamaId, Long userId) {
        BigDecimal s = savings(chamaId, userId);
        return s.subtract(finesTaken(chamaId, userId, s));
    }

    /** Reasons the member cannot leave right now. Empty means they can. */
    List<String> blockers(Long chamaId, Long userId) {
        List<String> out = new ArrayList<>();
        ChamaMember m = memberRepo.findByChamaChamaIdAndUserUserId(chamaId, userId).filter(ChamaMember::getIsActive).orElse(null);
        if (m == null) { out.add("Not an active member"); return out; }
        if ("CHAIRPERSON".equalsIgnoreCase(m.getRole())) out.add("The chairperson must hand over the role first");
        if (loanRepo.findByBorrowerUserId(userId).stream().anyMatch(l -> l.getChama().getChamaId().equals(chamaId) && OPEN_LOAN.contains(String.valueOf(l.getStatus()).toUpperCase())))
            out.add("A loan is not settled yet");
        if (guarantorRepo.findByGuarantorUserUserId(userId).stream().anyMatch(g -> g.getLoan().getChama().getChamaId().equals(chamaId)
                && !"REJECTED".equalsIgnoreCase(g.getStatus()) && OPEN_LOAN.contains(String.valueOf(g.getLoan().getStatus()).toUpperCase())))
            out.add("They are guaranteeing a loan that is not settled yet");
        if (roscaRepo.findByChamaChamaId(chamaId).stream().anyMatch(c -> "ACTIVE".equalsIgnoreCase(c.getStatus())))
            out.add("A merry-go-round cycle is running. Leave when it ends");
        boolean inAsca = ascaCycleRepo.findByChamaChamaId(chamaId).stream()
                .filter(c -> "ACTIVE".equalsIgnoreCase(c.getStatus()) || "CLOSING".equalsIgnoreCase(c.getStatus()))
                .anyMatch(c -> ascaMemberRepo.findByCycleCycleIdAndUserUserId(c.getCycleId(), userId)
                        .map(a -> a.getTotalInvestment() != null && a.getTotalInvestment().signum() > 0).orElse(false));
        if (inAsca) out.add("They hold shares in the running cycle. Leave after the cycle is shared out");
        return out;
    }

    public boolean hasOpenExit(Long chamaId, Long userId) {
        return !exitRepo.findByChamaChamaIdAndUserUserIdAndStatusIn(chamaId, userId, OPEN).isEmpty();
    }

    @Transactional
    public MemberExit requestLeave(Long chamaId, Long userId) {
        membership.activeMember(chamaId, userId);
        return open(chamaId, userId, userId, "LEAVE");
    }

    @Transactional
    public MemberExit requestRemoval(Long chamaId, Long officialId, Long targetId) {
        membership.activeOfficial(chamaId, officialId);
        if (officialId.equals(targetId)) throw new IllegalStateException("You cannot remove yourself. Use leave instead");
        ChamaMember target = memberRepo.findByChamaChamaIdAndUserUserId(chamaId, targetId).filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new IllegalArgumentException("That person is not an active member"));
        if (MembershipService.isOfficial(target) && !"CHAIRPERSON".equalsIgnoreCase(membership.activeMember(chamaId, officialId).getRole()))
            throw new AccessDeniedException("Only the chairperson can remove an official");
        return open(chamaId, targetId, officialId, "REMOVAL");
    }

    private MemberExit open(Long chamaId, Long userId, Long requestedBy, String kind) {
        if (hasOpenExit(chamaId, userId)) throw new IllegalStateException("There is already an exit in progress for this member");
        List<String> why = blockers(chamaId, userId);
        if (!why.isEmpty()) throw new IllegalStateException(String.join(". ", why));
        Chama chama = chamaRepo.findById(chamaId).orElseThrow(() -> new RuntimeException("Chama not found"));
        MemberExit e = exitRepo.save(MemberExit.builder().chama(chama).user(userRepo.getReferenceById(userId)).kind(kind).status("REQUESTED")
                .refundAmount(netRefund(chamaId, userId)).requestedBy(requestedBy).build());
        audit(requestedBy, "MEMBER_EXIT_REQUESTED", e, "Member exit (" + kind + ") requested, refund KES " + e.getRefundAmount().toPlainString());
        return e;
    }

    /** True when exactly one official could act on this exit, so the two-person rule would otherwise block it for good. */
    private boolean soleOfficial(Long chamaId, Long memberId) {
        return memberRepo.findByChamaChamaIdAndIsActiveTrue(chamaId).stream()
                .filter(MembershipService::isOfficial).filter(o -> !o.getUser().getUserId().equals(memberId)).count() <= 1;
    }

    @Transactional
    public MemberExit approve(Long chamaId, Long exitId, Long officialId, boolean approve, String note) {
        membership.activeOfficial(chamaId, officialId);
        MemberExit e = load(chamaId, exitId);
        if (!"REQUESTED".equals(e.getStatus())) throw new IllegalStateException("This exit has already been decided");
        Long memberId = e.getUser().getUserId();
        if (officialId.equals(memberId)) throw new AccessDeniedException("You cannot decide your own exit");
        if (!approve) {
            if (note == null || note.isBlank()) throw new IllegalArgumentException("Give a reason for declining");
            e.setStatus("DECLINED"); e.setNote(trim(note));
            audit(officialId, "MEMBER_EXIT_DECLINED", e, trim(note));
            return exitRepo.save(e);
        }
        if (officialId.equals(e.getRequestedBy()) && "REMOVAL".equals(e.getKind()) && !soleOfficial(chamaId, memberId))
            throw new AccessDeniedException("You started this removal, so a different official must approve it");
        List<String> why = blockers(chamaId, memberId);
        if (!why.isEmpty()) throw new IllegalStateException(String.join(". ", why));
        e.setRefundAmount(netRefund(chamaId, memberId));
        e.setApprovedBy(officialId);
        e.setStatus("APPROVED");
        audit(officialId, "MEMBER_EXIT_APPROVED", e, "Refund KES " + e.getRefundAmount().toPlainString() + " approved");
        return exitRepo.save(e);
    }

    /** Pays the refund out of the chama fund and removes the member. A different official from the approver, unless there is only one. */
    @Transactional
    public MemberExit pay(Long chamaId, Long exitId, Long officialId, String reference) {
        membership.activeOfficial(chamaId, officialId);
        MemberExit e = load(chamaId, exitId);
        if (!"APPROVED".equals(e.getStatus())) throw new IllegalStateException("This exit has not been approved yet");
        Long memberId = e.getUser().getUserId();
        if (officialId.equals(memberId)) throw new AccessDeniedException("You cannot pay out your own exit");
        if (officialId.equals(e.getApprovedBy()) && !soleOfficial(chamaId, memberId))
            throw new AccessDeniedException("You approved this exit, so a different official must pay it out");
        List<String> why = blockers(chamaId, memberId);
        if (!why.isEmpty()) throw new IllegalStateException(String.join(". ", why));
        Chama chama = chamaRepo.findByIdWithPessimisticLock(chamaId).orElseThrow(() -> new RuntimeException("Chama not found"));
        BigDecimal gross = savings(chamaId, memberId);
        BigDecimal fineCut = fineService.settleFromRefund(chamaId, memberId, finesTaken(chamaId, memberId, gross), e.getExitId());
        BigDecimal refund = gross.subtract(fineCut);
        if (fineCut.signum() > 0) {
            // Savings leave the member's account; the fines part stays in the fund as a FINE receipt, so the fund only drops by the net refund.
            contributionRepo.save(Contribution.builder().chama(chama).user(e.getUser()).amount(fineCut.negate()).contributionType("REGULAR")
                    .status("COMPLETED").reference("EXITFINE-" + e.getExitId()).recordedBy(officialId).notes("Savings applied to unpaid fines on leaving").isDeleted(false).build());
            contributionRepo.save(Contribution.builder().chama(chama).user(e.getUser()).amount(fineCut).contributionType("FINE")
                    .status("COMPLETED").reference("EXITFINE-" + e.getExitId()).recordedBy(officialId).notes("Unpaid fines settled from the exit refund").isDeleted(false).build());
        }
        ledger.postFinesFromSavings(chama, fineCut, e.getExitId(), officialId);
        if (refund.signum() > 0) {
            if (reference == null || reference.isBlank()) throw new IllegalArgumentException("Enter the payment reference (for example the M-Pesa code) of the refund");
            if (chama.getCurrentFund().compareTo(refund) < 0)
                throw new IllegalStateException("The chama fund holds KES " + chama.getCurrentFund().toPlainString() + ", less than the refund of KES " + refund.toPlainString());
            contributionRepo.save(Contribution.builder().chama(chama).user(e.getUser()).amount(refund.negate()).contributionType("REGULAR")
                    .status("COMPLETED").reference("EXIT-" + e.getExitId()).recordedBy(officialId).notes("Savings refunded on leaving the chama").isDeleted(false).build());
            chama.setCurrentFund(chama.getCurrentFund().subtract(refund));
            chamaRepo.save(chama);
            ledger.post(chama, LedgerEntry.CHAMA_FUND, refund.negate(), "MEMBER_EXIT_REFUND", "MEMBER_EXIT", e.getExitId(), officialId, "Savings refunded to departing member");
        }
        ChamaMember m = memberRepo.findByChamaChamaIdAndUserUserId(chamaId, memberId).orElseThrow();
        m.setIsActive(false); m.setStatus("INACTIVE"); m.setTotalContributions(BigDecimal.ZERO);
        memberRepo.save(m);
        membership.syncMemberCount(chama);
        e.setRefundAmount(refund); e.setPaidBy(officialId); e.setPayoutReference(reference == null ? null : reference.trim());
        e.setStatus("COMPLETED"); e.setCompletedAt(java.time.ZonedDateTime.now());
        audit(officialId, "MEMBER_EXIT_PAID", e, "Refund KES " + refund.toPlainString() + (fineCut.signum() > 0 ? " after KES " + fineCut.toPlainString() + " of unpaid fines" : "") + " paid, reference " + e.getPayoutReference());
        notifRepo.save(Notification.builder().user(e.getUser()).title("You have left " + chama.getChamaName())
                .message((fineCut.signum() > 0 ? "KES " + fineCut.toPlainString() + " of unpaid fines was taken from your savings. " : "") + "KES " + refund.toPlainString() + " was refunded. Open your closing statement in the app for the details.")
                .type("MEMBER_EXIT").entityType("MEMBER_EXIT").entityId(e.getExitId()).build());
        return exitRepo.save(e);
    }

    @Transactional
    public MemberExit cancel(Long chamaId, Long exitId, Long actorId) {
        MemberExit e = load(chamaId, exitId);
        if (!OPEN.contains(e.getStatus())) throw new IllegalStateException("This exit is already finished");
        boolean ownerOrStarter = actorId.equals(e.getUser().getUserId()) || actorId.equals(e.getRequestedBy());
        if (!ownerOrStarter) membership.activeOfficial(chamaId, actorId);
        e.setStatus("CANCELLED");
        audit(actorId, "MEMBER_EXIT_CANCELLED", e, "Exit cancelled");
        return exitRepo.save(e);
    }

    /** The member's closing statement: what they paid in, what was applied against loans, what was refunded. */
    @Transactional(readOnly = true)
    public Map<String, Object> statement(Long chamaId, Long exitId, Long viewerId) {
        MemberExit e = load(chamaId, exitId);
        if (!viewerId.equals(e.getUser().getUserId())) membership.activeOfficial(chamaId, viewerId);
        Long uid = e.getUser().getUserId();
        BigDecimal paidIn = BigDecimal.ZERO, applied = BigDecimal.ZERO, refunded = BigDecimal.ZERO, finesTaken = BigDecimal.ZERO;
        for (Contribution c : contributionRepo.findByUserUserIdAndIsDeletedFalse(uid)) {
            if (c.getChama() == null || !chamaId.equals(c.getChama().getChamaId()) || !"COMPLETED".equalsIgnoreCase(c.getStatus())) continue;
            if (c.getContributionType() != null && !"REGULAR".equalsIgnoreCase(c.getContributionType())) continue;
            String ref = c.getReference() == null ? "" : c.getReference();
            if (c.getAmount().signum() > 0) paidIn = paidIn.add(c.getAmount());
            else if (ref.startsWith("EXITFINE-")) finesTaken = finesTaken.add(c.getAmount().negate());
            else if (ref.startsWith("EXIT-")) refunded = refunded.add(c.getAmount().negate());
            else applied = applied.add(c.getAmount().negate());
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("exit_id", e.getExitId());
        m.put("member", e.getUser().getFirstName() + " " + e.getUser().getLastName());
        m.put("chama", e.getChama().getChamaName());
        m.put("kind", e.getKind());
        m.put("status", e.getStatus());
        m.put("savings_paid_in", paidIn);
        m.put("applied_to_guaranteed_loans", applied);
        m.put("unpaid_fines_deducted", "COMPLETED".equals(e.getStatus()) ? finesTaken : finesTaken(chamaId, uid, savings(chamaId, uid)));
        m.put("refund", "COMPLETED".equals(e.getStatus()) ? refunded : e.getRefundAmount());
        m.put("payout_reference", e.getPayoutReference());
        m.put("completed_at", e.getCompletedAt());
        return m;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(Long chamaId, Long viewerId) {
        boolean official = MembershipService.isOfficial(membership.activeMember(chamaId, viewerId));
        List<Map<String, Object>> out = new ArrayList<>();
        for (MemberExit e : exitRepo.findByChamaChamaIdOrderByCreatedAtDesc(chamaId)) {
            if (!official && !e.getUser().getUserId().equals(viewerId)) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("exit_id", e.getExitId());
            m.put("user_id", e.getUser().getUserId());
            m.put("member_name", e.getUser().getFirstName() + " " + e.getUser().getLastName());
            m.put("kind", e.getKind());
            m.put("status", e.getStatus());
            m.put("refund_amount", e.getRefundAmount());
            m.put("requested_by", e.getRequestedBy());
            m.put("approved_by", e.getApprovedBy());
            m.put("note", e.getNote());
            m.put("payout_reference", e.getPayoutReference());
            m.put("created_at", e.getCreatedAt());
            out.add(m);
        }
        return out;
    }

    /** What the member would get if they left now, and anything in the way. Shown before they ask. */
    @Transactional(readOnly = true)
    public Map<String, Object> preview(Long chamaId, Long userId) {
        membership.activeMember(chamaId, userId);
        Map<String, Object> m = new LinkedHashMap<>();
        BigDecimal sv = savings(chamaId, userId);
        BigDecimal cut = finesTaken(chamaId, userId, sv);
        m.put("savings", sv);
        m.put("unpaid_fines_deducted", cut);
        m.put("unpaid_fines_left_over", fineService.outstandingFor(chamaId, userId).subtract(cut));
        m.put("refund", sv.subtract(cut));
        m.put("blockers", blockers(chamaId, userId));
        m.put("open_exit", hasOpenExit(chamaId, userId));
        return m;
    }

    private MemberExit load(Long chamaId, Long exitId) {
        MemberExit e = exitRepo.findById(exitId).orElseThrow(() -> new IllegalArgumentException("Exit not found"));
        if (!e.getChama().getChamaId().equals(chamaId)) throw new IllegalArgumentException("Exit not found");
        return e;
    }

    private static String trim(String s) { return s == null ? null : s.trim().substring(0, Math.min(300, s.trim().length())); }

    private void audit(Long actorId, String type, MemberExit e, String text) {
        auditRepo.save(FinancialAuditLog.builder().user(userRepo.getReferenceById(actorId)).transactionType(type)
                .amount(e.getRefundAmount()).chama(e.getChama()).referenceId(e.getExitId()).description(text)
                .ipAddress(com.chamasmart.backend.security.ClientIp.current()).userAgent(com.chamasmart.backend.security.ClientIp.currentUserAgent()).build());
    }
}
