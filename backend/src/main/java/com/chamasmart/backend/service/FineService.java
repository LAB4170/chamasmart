package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZonedDateTime;
import java.util.*;

/** Fines: officials issue and waive them, the daily job issues late-round fines, and verified FINE payments settle them. */
@Service
@RequiredArgsConstructor
public class FineService {
    private static final BigDecimal MAX_FINE = new BigDecimal("1000000");

    private final MemberFineRepository fines;
    private final ChamaRepository chamaRepository;
    private final UserRepository userRepository;
    private final MembershipService membership;
    private final NotificationRepository notificationRepository;
    private final FinancialAuditLogRepository auditLogRepository;

    private static Map<String, Object> row(MemberFine f) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("fine_id", f.getFineId());
        m.put("user_id", f.getUser().getUserId());
        m.put("member_name", f.getUser().getFirstName() + " " + f.getUser().getLastName());
        m.put("amount", f.getAmount());
        m.put("amount_paid", f.getAmountPaid());
        m.put("outstanding", f.outstanding());
        m.put("reason", f.getReason());
        m.put("source", f.getSource());
        m.put("status", f.getStatus());
        m.put("issued_by_system", f.getIssuedBy() == null);
        m.put("closed_note", f.getClosedNote());
        m.put("created_at", f.getCreatedAt());
        return m;
    }

    private void tell(User user, String title, String message, Long chamaId) {
        notificationRepository.save(Notification.builder().user(user).title(title).message(message)
                .type("FINE").entityType("CHAMA").entityId(chamaId).build());
    }

    private void audit(Long actorId, Chama chama, MemberFine f, String type, String text) {
        FinancialAuditLog.FinancialAuditLogBuilder b = FinancialAuditLog.builder().transactionType(type).amount(f.getAmount())
                .chama(chama).referenceId(f.getFineId()).description(text)
                .ipAddress(com.chamasmart.backend.security.ClientIp.current())
                .userAgent(com.chamasmart.backend.security.ClientIp.currentUserAgent());
        if (actorId != null) b.user(userRepository.getReferenceById(actorId));
        auditLogRepository.save(b.build());
    }

    /** Officials see everyone's fines; members see their own. */
    @Transactional(readOnly = true)
    public Map<String, Object> list(Long chamaId, Long actorId) {
        ChamaMember me = membership.activeMember(chamaId, actorId);
        boolean official = MembershipService.isOfficial(me);
        List<MemberFine> all = official ? fines.findByChamaChamaIdOrderByCreatedAtDesc(chamaId)
                : fines.findByChamaChamaIdAndUserUserIdOrderByCreatedAtDesc(chamaId, actorId);
        BigDecimal outstanding = all.stream().filter(f -> "OWED".equals(f.getStatus())).map(MemberFine::outstanding).reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("can_manage", official);
        out.put("outstanding_total", outstanding);
        out.put("fines", all.stream().map(FineService::row).toList());
        return out;
    }

    @Transactional
    public Map<String, Object> issue(Long chamaId, Long actorId, Long userId, BigDecimal amount, String reason) {
        membership.activeOfficial(chamaId, actorId);
        if (userId == null) throw new IllegalArgumentException("Choose the member being fined");
        if (userId.equals(actorId)) throw new IllegalArgumentException("An official cannot fine themselves; ask another official");
        if (amount == null || amount.signum() <= 0 || amount.compareTo(MAX_FINE) > 0) throw new IllegalArgumentException("Enter a fine amount above zero");
        if (reason == null || reason.trim().length() < 3) throw new IllegalArgumentException("Give a reason the member can read");
        membership.activeMember(chamaId, userId);
        Chama chama = chamaRepository.findById(chamaId).orElseThrow(() -> new IllegalArgumentException("Chama not found"));
        User user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("Member not found"));
        MemberFine f = fines.save(MemberFine.builder().chama(chama).user(user).amount(amount.setScale(2, RoundingMode.HALF_UP))
                .reason(reason.trim()).source("MANUAL").roundNo(0).issuedBy(actorId).build());
        audit(actorId, chama, f, "FINE_ISSUED", "Fine issued: " + f.getReason());
        tell(user, "You have been fined", "KES " + f.getAmount() + " in " + chama.getChamaName() + ": " + f.getReason(), chamaId);
        return row(f);
    }

    /** The daily job. Idempotent: the same member is never fined twice for the same round. Returns whether a fine was created. */
    @Transactional
    public boolean issueLateRoundFine(Chama chama, RoscaCycle cycle, int round, User user, BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) return false;
        if (fines.existsBySourceAndCycleIdAndRoundNoAndUserUserId("ROSCA_LATE", cycle.getCycleId(), round, user.getUserId())) return false;
        MemberFine f = fines.save(MemberFine.builder().chama(chama).user(user).amount(amount.setScale(2, RoundingMode.HALF_UP))
                .reason("Round " + round + " of " + cycle.getCycleName() + " was not paid in time").source("ROSCA_LATE")
                .cycleId(cycle.getCycleId()).roundNo(round).build());
        audit(null, chama, f, "FINE_ISSUED", "Automatic late fine: " + f.getReason());
        tell(user, "Late payment fine", "KES " + f.getAmount() + " in " + chama.getChamaName() + ": " + f.getReason()
                + ". Pay it as a Fine contribution. An official can waive it if there is a good reason.", chama.getChamaId());
        return true;
    }

    @Transactional
    public Map<String, Object> waive(Long chamaId, Long actorId, Long fineId, String note) {
        membership.activeOfficial(chamaId, actorId);
        MemberFine f = fines.findById(fineId).filter(x -> x.getChama().getChamaId().equals(chamaId)).orElseThrow(() -> new IllegalArgumentException("Fine not found"));
        if (!"OWED".equals(f.getStatus())) throw new IllegalStateException("This fine is already closed");
        if (f.getUser().getUserId().equals(actorId)) throw new IllegalArgumentException("An official cannot waive their own fine; ask another official");
        if (note == null || note.trim().length() < 3) throw new IllegalArgumentException("Say why the fine is waived");
        f.setStatus("WAIVED"); f.setClosedBy(actorId); f.setClosedNote(note.trim()); f.setClosedAt(ZonedDateTime.now());
        fines.save(f);
        audit(actorId, f.getChama(), f, "FINE_WAIVED", "Fine waived: " + note.trim());
        tell(f.getUser(), "A fine was waived", "KES " + f.getAmount() + " in " + f.getChama().getChamaName() + " no longer needs paying.", chamaId);
        return row(f);
    }

    /** Called when a FINE payment is credited: applies it to the member's oldest fines first. */
    @Transactional
    public BigDecimal settle(Long chamaId, Long userId, BigDecimal paid) {
        BigDecimal left = paid == null ? BigDecimal.ZERO : paid;
        for (MemberFine f : fines.findByChamaChamaIdAndUserUserIdAndStatusOrderByCreatedAtAsc(chamaId, userId, "OWED")) {
            if (left.signum() <= 0) break;
            BigDecimal use = left.min(f.outstanding());
            f.setAmountPaid(f.getAmountPaid().add(use));
            left = left.subtract(use);
            if (f.outstanding().signum() == 0) { f.setStatus("PAID"); f.setClosedAt(ZonedDateTime.now()); f.setClosedNote("Paid"); }
            fines.save(f);
        }
        return left;
    }
}
