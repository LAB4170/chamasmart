package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;

/**
 * Spending chama money takes more than one person. One official asks. Another approves (two others for large amounts).
 * The first payout of a chama and every large one waits a day after approval so a hijacked account cannot empty the fund at once.
 * A daily cap limits the damage of any single bad day. The money only leaves the fund, and the journal, when someone records the real
 * payment reference, and the fund is checked again at that moment.
 */
@Service
@RequiredArgsConstructor
public class PayoutService {
    static final BigDecimal MAX_ONE = new BigDecimal("10000000");

    private final PayoutRepository payouts;
    private final PayoutApprovalRepository approvals;
    private final ChamaRepository chamas;
    private final MembershipService membership;
    private final UserRepository users;
    private final LedgerService ledger;
    private final FinancialAuditLogRepository auditRepo;
    private final NotificationRepository notifications;
    private final ChamaMemberRepository members;
    private final EnforcementService enforcement;
    private final VerificationService verification;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private SubscriptionService subscriptions;
    @Value("${app.payouts.daily-cap:500000}") BigDecimal dailyCap = new BigDecimal("500000");
    @Value("${app.payouts.large-threshold:100000}") BigDecimal largeThreshold = new BigDecimal("100000");
    @Value("${app.payouts.hold-hours:24}") int holdHours = 24;
    @Value("${app.payouts.expiry-days:7}") int expiryDays = 7;
    /** For this many days after a chama is listed publicly, payouts are held longer and capped lower. */
    @Value("${app.payouts.new-listing-days:30}") int newListingDays = 30;
    @Value("${app.payouts.new-listing-hold-hours:72}") int newListingHoldHours = 72;
    @Value("${app.payouts.new-listing-daily-cap:100000}") BigDecimal newListingDailyCap = new BigDecimal("100000");

    @Transactional
    public Map<String, Object> request(Long chamaId, Long actorId, BigDecimal amount, String payeeName, String payeePhone, String reason, String key) {
        membership.activeOfficial(chamaId, actorId);
        if (enforcement.frozen(chamaId)) throw new IllegalStateException("Payouts are paused on this chama because of an open notice from ChamaSmart. See the notice on the chama page");
        if (subscriptions != null && !subscriptions.allowsNewActivity(chamaId)) throw new IllegalStateException(SubscriptionService.SUSPENDED_MESSAGE);
        if (key == null || key.isBlank() || key.length() > 64) throw new IllegalArgumentException("A request key of 1 to 64 characters is required");
        Optional<Payout> again = payouts.findByRequestedByAndIdempotencyKey(actorId, key);
        if (again.isPresent()) return view(again.get());
        if (amount == null || amount.signum() <= 0 || amount.compareTo(MAX_ONE) > 0) throw new IllegalArgumentException("Enter an amount above zero");
        amount = amount.setScale(2, RoundingMode.HALF_UP);
        if (payeeName == null || payeeName.trim().length() < 2) throw new IllegalArgumentException("Say who is being paid");
        if (reason == null || reason.trim().length() < 5) throw new IllegalArgumentException("Give a reason of at least a few words");
        String phone = normalisePhone(payeePhone);
        Chama chama = chamas.findById(chamaId).orElseThrow(() -> new IllegalArgumentException("Chama not found"));
        if (amount.compareTo(chama.getCurrentFund()) > 0) throw new IllegalStateException("The chama fund holds KES " + chama.getCurrentFund().toPlainString() + ", less than this payout");
        if (phone != null && phoneBelongsToOfficial(chamaId, phone)) throw new AccessDeniedException("An official cannot pay themselves or another official through this route");
        BigDecimal today = payouts.committedSince(chamaId, ZonedDateTime.now(ZoneId.of("Africa/Nairobi")).toLocalDate().atStartOfDay(ZoneId.of("Africa/Nairobi")));
        BigDecimal cap = verification.recentlyListed(chamaId, newListingDays) ? newListingDailyCap.min(dailyCap) : dailyCap;
        if (today.add(amount).compareTo(cap) > 0)
            throw new IllegalStateException("This would take today's payouts above the daily limit of KES " + cap.toPlainString() + " (already asked for: KES " + today.toPlainString() + ")");
        boolean large = amount.compareTo(largeThreshold) >= 0;
        Payout p = payouts.save(Payout.builder().chamaId(chamaId).amount(amount).payeeName(payeeName.trim()).payeePhone(phone).reason(reason.trim())
                .status("REQUESTED").requiredApprovals(large ? 2 : 1).requestedBy(actorId).idempotencyKey(key).build());
        audit(actorId, chama, p, "PAYOUT_REQUESTED", "Payout of KES " + amount.toPlainString() + " to " + p.getPayeeName() + " requested: " + p.getReason());
        notifyOfficials(chama, actorId, "Payout waiting for approval", "KES " + amount.toPlainString() + " to " + p.getPayeeName() + ". " + p.getReason(), p.getPayoutId());
        return view(p);
    }

    @Transactional
    public Map<String, Object> approve(Long chamaId, Long actorId, Long payoutId) {
        membership.activeOfficial(chamaId, actorId);
        if (enforcement.frozen(chamaId)) throw new IllegalStateException("Payouts are paused on this chama because of an open notice from ChamaSmart. See the notice on the chama page");
        Payout p = loadLocked(chamaId, payoutId);
        if (!"REQUESTED".equals(p.getStatus())) throw new IllegalStateException("This payout is " + p.getStatus().toLowerCase() + " and cannot be approved");
        if (p.getRequestedBy().equals(actorId)) throw new AccessDeniedException("You asked for this payout, so someone else must approve it");
        if (approvals.existsByPayoutIdAndApproverId(payoutId, actorId)) throw new IllegalStateException("You have already approved this payout");
        Chama chama = chamas.findById(chamaId).orElseThrow();
        User actor = users.findById(actorId).orElseThrow();
        if (p.getPayeePhone() != null && p.getPayeePhone().equals(safePhone(actor.getPhoneNumber()))) throw new AccessDeniedException("You cannot approve a payout to yourself");
        approvals.save(PayoutApproval.builder().payoutId(payoutId).approverId(actorId).build());
        int have = approvals.findByPayoutId(payoutId).size();
        audit(actorId, chama, p, "PAYOUT_APPROVED", "Approval " + have + " of " + p.getRequiredApprovals());
        if (have >= p.getRequiredApprovals()) {
            boolean first = !payouts.existsByChamaIdAndStatus(chamaId, "PAID");
            boolean large = p.getRequiredApprovals() > 1;
            p.setStatus("APPROVED");
            boolean fresh = verification.recentlyListed(chamaId, newListingDays);
            p.setReleaseAt(fresh ? ZonedDateTime.now().plusHours(Math.max(holdHours, newListingHoldHours)) : first || large ? ZonedDateTime.now().plusHours(holdHours) : ZonedDateTime.now());
            payouts.save(p);
            notifyOfficials(chama, actorId, "Payout approved", "KES " + p.getAmount().toPlainString() + " to " + p.getPayeeName()
                    + (p.getReleaseAt().isAfter(ZonedDateTime.now()) ? ". It can be sent after " + p.getReleaseAt().withZoneSameInstant(ZoneId.of("Africa/Nairobi")).toLocalDateTime().toString().replace('T', ' ') + "." : ". It can be sent now."), payoutId);
        }
        return view(p);
    }

    @Transactional
    public Map<String, Object> reject(Long chamaId, Long actorId, Long payoutId, String note) {
        membership.activeOfficial(chamaId, actorId);
        if (note == null || note.isBlank()) throw new IllegalArgumentException("Say why you are rejecting this payout");
        Payout p = loadLocked(chamaId, payoutId);
        if (!List.of("REQUESTED", "APPROVED").contains(p.getStatus())) throw new IllegalStateException("This payout is " + p.getStatus().toLowerCase() + " and cannot be rejected");
        if (p.getRequestedBy().equals(actorId)) throw new AccessDeniedException("Use cancel to withdraw your own request");
        p.setStatus("REJECTED"); p.setDecisionNote(cut(note.trim()));
        payouts.save(p);
        audit(actorId, chamas.findById(chamaId).orElseThrow(), p, "PAYOUT_REJECTED", cut(note.trim()));
        return view(p);
    }

    @Transactional
    public Map<String, Object> cancel(Long chamaId, Long actorId, Long payoutId) {
        membership.activeOfficial(chamaId, actorId);
        Payout p = loadLocked(chamaId, payoutId);
        if (!p.getRequestedBy().equals(actorId)) throw new AccessDeniedException("Only the official who asked for this payout can cancel it");
        if (!List.of("REQUESTED", "APPROVED").contains(p.getStatus())) throw new IllegalStateException("This payout is " + p.getStatus().toLowerCase() + " and cannot be cancelled");
        p.setStatus("CANCELLED");
        payouts.save(p);
        audit(actorId, chamas.findById(chamaId).orElseThrow(), p, "PAYOUT_CANCELLED", "Withdrawn by the requester");
        return view(p);
    }

    /** After the money has really been sent (for example by M-Pesa), record the code. This is the moment the fund and the journal move. */
    @Transactional
    public Map<String, Object> markPaid(Long chamaId, Long actorId, Long payoutId, String reference) {
        if (enforcement.frozen(chamaId)) throw new IllegalStateException("Payouts are paused on this chama because of an open notice from ChamaSmart. See the notice on the chama page");
        membership.activeOfficial(chamaId, actorId);
        String ref = reference == null ? "" : reference.replaceAll("\\s+", "").toUpperCase();
        if (!ref.matches("[A-Z0-9]{8,14}")) throw new IllegalArgumentException("Enter the payment reference, such as the M-Pesa code");
        Payout p = loadLocked(chamaId, payoutId);
        if (!"APPROVED".equals(p.getStatus())) throw new IllegalStateException("This payout is " + p.getStatus().toLowerCase() + " and cannot be marked as paid");
        if (p.getReleaseAt() != null && p.getReleaseAt().isAfter(ZonedDateTime.now())) throw new IllegalStateException("This payout is on hold until " + p.getReleaseAt().withZoneSameInstant(ZoneId.of("Africa/Nairobi")).toLocalDateTime().toString().replace('T', ' '));
        Chama chama = chamas.findByIdWithPessimisticLock(chamaId).orElseThrow(() -> new IllegalArgumentException("Chama not found"));
        if (chama.getCurrentFund().compareTo(p.getAmount()) < 0) throw new IllegalStateException("The chama fund now holds KES " + chama.getCurrentFund().toPlainString() + ", less than this payout");
        chama.setCurrentFund(chama.getCurrentFund().subtract(p.getAmount()));
        chamas.save(chama);
        ledger.post(chama, LedgerEntry.CHAMA_FUND, p.getAmount().negate(), "EXPENSE_PAYOUT", "PAYOUT", p.getPayoutId(), actorId, "Paid to " + p.getPayeeName() + ": " + p.getReason());
        p.setStatus("PAID"); p.setPaidBy(actorId); p.setPaidAt(ZonedDateTime.now()); p.setPaymentReference(ref);
        payouts.save(p);
        audit(actorId, chama, p, "PAYOUT_PAID", "Paid to " + p.getPayeeName() + ", reference " + ref);
        return view(p);
    }

    @Transactional
    public List<Map<String, Object>> list(Long chamaId, Long actorId) {
        membership.activeOfficial(chamaId, actorId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Payout p : payouts.findTop100ByChamaIdOrderByCreatedAtDesc(chamaId)) {
            if (List.of("REQUESTED", "APPROVED").contains(p.getStatus()) && p.getCreatedAt().plusDays(expiryDays).isBefore(ZonedDateTime.now())) {
                p.setStatus("EXPIRED"); payouts.save(p);
            }
            out.add(view(p));
        }
        return out;
    }

    private Payout loadLocked(Long chamaId, Long payoutId) {
        return payouts.lockById(payoutId).filter(p -> p.getChamaId().equals(chamaId)).orElseThrow(() -> new IllegalArgumentException("Payout not found"));
    }

    private boolean phoneBelongsToOfficial(Long chamaId, String phone) {
        return members.findByChamaChamaIdAndIsActiveTrue(chamaId).stream().filter(MembershipService::isOfficial)
                .anyMatch(m -> phone.equals(safePhone(m.getUser().getPhoneNumber())));
    }

    /** For numbers already stored on profiles, which may not be tidy: anything unreadable counts as no number. */
    static String safePhone(String raw) {
        try { return normalisePhone(raw); } catch (IllegalArgumentException e) { return null; }
    }

    /** Kenyan mobile numbers only, stored as 2547XXXXXXXX or 2541XXXXXXXX. Blank is allowed (paid another way). */
    static String normalisePhone(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String d = raw.replaceAll("[\\s()-]", "");
        if (d.startsWith("+")) d = d.substring(1);
        if (d.matches("0[17]\\d{8}")) d = "254" + d.substring(1);
        if (!d.matches("254[17]\\d{8}")) throw new IllegalArgumentException("Enter a Kenyan mobile number such as 0712345678");
        return d;
    }

    private void audit(Long actorId, Chama chama, Payout p, String type, String text) {
        auditRepo.save(FinancialAuditLog.builder().user(users.getReferenceById(actorId)).transactionType(type).amount(p.getAmount()).chama(chama)
                .referenceId(p.getPayoutId()).description(cut(text)).ipAddress(com.chamasmart.backend.security.ClientIp.current())
                .userAgent(com.chamasmart.backend.security.ClientIp.currentUserAgent()).build());
    }

    private void notifyOfficials(Chama chama, Long exceptUserId, String title, String message, Long payoutId) {
        for (ChamaMember m : members.findByChamaChamaIdAndIsActiveTrue(chama.getChamaId())) {
            if (!MembershipService.isOfficial(m) || m.getUser().getUserId().equals(exceptUserId)) continue;
            notifications.save(Notification.builder().user(m.getUser()).title(title).message(cut(message)).type("PAYOUT").entityType("PAYOUT").entityId(payoutId).build());
        }
    }

    private Map<String, Object> view(Payout p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("payout_id", p.getPayoutId()); m.put("amount", p.getAmount()); m.put("payee_name", p.getPayeeName()); m.put("payee_phone", p.getPayeePhone());
        m.put("reason", p.getReason()); m.put("status", p.getStatus()); m.put("requested_by", p.getRequestedBy());
        m.put("required_approvals", p.getRequiredApprovals()); m.put("approvals", approvals.findByPayoutId(p.getPayoutId()).size());
        m.put("release_at", p.getReleaseAt()); m.put("paid_at", p.getPaidAt()); m.put("payment_reference", p.getPaymentReference());
        m.put("decision_note", p.getDecisionNote()); m.put("created_at", p.getCreatedAt());
        return m;
    }

    private static String cut(String s) { return s == null ? null : s.length() > 290 ? s.substring(0, 290) : s; }
}
