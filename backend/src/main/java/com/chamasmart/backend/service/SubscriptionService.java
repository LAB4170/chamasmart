package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.payments.PaystackProvider;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.*;

/**
 * A chama's plan with the platform. Lifecycle: TRIAL (30 days) or ACTIVE, then PAST_DUE when the period ends unpaid, then SUSPENDED after a
 * 7-day grace. A suspended chama keeps every record and can read everything; limits on new activity are applied by whoever calls
 * {@link #allowsNewActivity(Long)}. Nothing is ever deleted for non-payment.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SubscriptionService {
    public static final int TRIAL_DAYS = 30, GRACE_DAYS = 7;
    public static final String SUSPENDED_MESSAGE = "This chama's ChamaSmart plan is overdue, so new payout requests and new members are paused. Contributions and all records still work. The chairperson can pay from the Plan page to continue.";

    private final SubscriptionPlanRepository plans;
    private final ChamaSubscriptionRepository subs;
    private final ChamaRepository chamas;
    private final ChamaMemberRepository members;
    private final MembershipService membership;
    private final NotificationRepository notifications;
    private final UserRepository users;
    private final PaystackProvider paystack;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> plans() {
        return plans.findByActiveTrueOrderByPriceAsc().stream().map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("plan_code", p.getPlanCode()); m.put("name", p.getDisplayName()); m.put("max_members", p.getMaxMembers());
            m.put("price", p.getPrice()); m.put("currency", p.getCurrency()); m.put("interval_months", p.getIntervalMonths());
            return m;
        }).toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> current(Long chamaId, Long actorId) {
        members.findByChamaChamaIdAndUserUserId(chamaId, actorId).filter(m -> Boolean.TRUE.equals(m.getIsActive()))
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("You are not an active member of this chama"));
        Optional<ChamaSubscription> s = subs.findFirstByChamaIdOrderBySubscriptionIdDesc(chamaId);
        String code = s.map(ChamaSubscription::getPlanCode).orElse("STARTER");
        SubscriptionPlan plan = plans.findById(code).orElseThrow();
        int count = members.findByChamaChamaIdAndIsActiveTrue(chamaId).size();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("plan_code", plan.getPlanCode()); m.put("plan_name", plan.getDisplayName()); m.put("price", plan.getPrice()); m.put("currency", plan.getCurrency());
        m.put("status", s.map(ChamaSubscription::getStatus).orElse("ACTIVE"));
        m.put("period_end", s.map(ChamaSubscription::getCurrentPeriodEnd).orElse(null));
        m.put("members", count); m.put("max_members", plan.getMaxMembers()); m.put("over_member_limit", count > plan.getMaxMembers());
        return m;
    }

    /** Chairperson picks a plan. A paid plan starts on a free trial; a plan too small for the current membership is refused. */
    @Transactional
    public Map<String, Object> choose(Long chamaId, Long actorId, String planCode) {
        membership.chairperson(chamaId, actorId);
        SubscriptionPlan plan = plans.findById(planCode == null ? "" : planCode.trim().toUpperCase()).filter(SubscriptionPlan::getActive)
                .orElseThrow(() -> new IllegalArgumentException("Choose one of the available plans"));
        int count = members.findByChamaChamaIdAndIsActiveTrue(chamaId).size();
        if (count > plan.getMaxMembers()) throw new IllegalStateException("This chama has " + count + " members, more than the " + plan.getMaxMembers() + " this plan allows");
        ChamaSubscription s = subs.findFirstByChamaIdOrderBySubscriptionIdDesc(chamaId).orElseGet(() -> ChamaSubscription.builder().chamaId(chamaId).status("ACTIVE").build());
        boolean paid = plan.getPrice().signum() > 0;
        boolean alreadyPaying = "ACTIVE".equals(s.getStatus()) && s.getCurrentPeriodEnd() != null && s.getCurrentPeriodEnd().isAfter(ZonedDateTime.now());
        s.setPlanCode(plan.getPlanCode());
        if (!paid) { s.setStatus("ACTIVE"); s.setCurrentPeriodEnd(null); }
        else if (!alreadyPaying && s.getSubscriptionId() == null) { s.setStatus("TRIAL"); s.setCurrentPeriodEnd(ZonedDateTime.now().plusDays(TRIAL_DAYS)); }
        else if (s.getCurrentPeriodEnd() == null) { s.setStatus("TRIAL"); s.setCurrentPeriodEnd(ZonedDateTime.now().plusDays(TRIAL_DAYS)); }
        subs.save(s);
        return current(chamaId, actorId);
    }

    /** Starts the hosted checkout for the chama's plan and returns where to send the chairperson. */
    @Transactional(readOnly = true)
    public Map<String, Object> checkout(Long chamaId, Long actorId, String email) {
        membership.chairperson(chamaId, actorId);
        ChamaSubscription s = subs.findFirstByChamaIdOrderBySubscriptionIdDesc(chamaId).orElseThrow(() -> new IllegalStateException("Choose a plan first"));
        SubscriptionPlan plan = plans.findById(s.getPlanCode()).orElseThrow();
        if (plan.getPrice().signum() <= 0) throw new IllegalStateException("This plan is free; there is nothing to pay");
        if (!paystack.isConfigured()) throw new IllegalStateException("Online payment is not switched on yet");
        String ref = "SUB-" + chamaId + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String url = paystack.initialize(email, plan.getPrice(), plan.getCurrency(), ref, Map.of("chama_id", chamaId, "plan_code", plan.getPlanCode()));
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("checkout_url", url); m.put("amount", plan.getPrice()); m.put("currency", plan.getCurrency()); m.put("plan_code", plan.getPlanCode());
        return m;
    }

    /** Called when a verified payment arrives. Returns null when applied, or the reason it was not (so the event is parked for a person). */
    @Transactional
    public String activateFromPayment(Long chamaId, String planCode, BigDecimal amount, String currency, String reference) {
        SubscriptionPlan plan = plans.findById(planCode).orElse(null);
        if (plan == null) return "Unknown plan " + planCode;
        if (amount == null || amount.compareTo(plan.getPrice()) != 0) return "Amount " + amount + " differs from the plan price " + plan.getPrice();
        if (currency == null || !currency.equalsIgnoreCase(plan.getCurrency())) return "Currency " + currency + " differs from the plan currency " + plan.getCurrency();
        if (!chamas.existsById(chamaId)) return "Chama not found";
        ChamaSubscription s = subs.findFirstByChamaIdOrderBySubscriptionIdDesc(chamaId).orElseGet(() -> ChamaSubscription.builder().chamaId(chamaId).build());
        ZonedDateTime base = s.getCurrentPeriodEnd() != null && s.getCurrentPeriodEnd().isAfter(ZonedDateTime.now()) && "ACTIVE".equals(s.getStatus()) ? s.getCurrentPeriodEnd() : ZonedDateTime.now();
        s.setPlanCode(plan.getPlanCode()); s.setStatus("ACTIVE"); s.setProvider("PAYSTACK"); s.setProviderRef(reference);
        s.setCurrentPeriodEnd(base.plusMonths(plan.getIntervalMonths()));
        subs.save(s);
        return null;
    }

    /** True unless the chama is suspended for non-payment. Callers decide what a suspended chama may no longer do. */
    @Transactional(readOnly = true)
    public boolean allowsNewActivity(Long chamaId) {
        return subs.findFirstByChamaIdOrderBySubscriptionIdDesc(chamaId).map(s -> !"SUSPENDED".equals(s.getStatus())).orElse(true);
    }

    /** Daily: move unpaid periods to PAST_DUE and then SUSPENDED, and tell the chairperson each time. */
    @Scheduled(cron = "${app.subscriptions.sweep-cron:0 30 6 * * *}")
    @Transactional
    public int sweep() {
        ZonedDateTime now = ZonedDateTime.now();
        int moved = 0;
        for (ChamaSubscription s : subs.findByStatusInAndCurrentPeriodEndBefore(List.of("TRIAL", "ACTIVE", "PAST_DUE"), now)) {
            if ("PAST_DUE".equals(s.getStatus())) {
                if (s.getCurrentPeriodEnd().plusDays(GRACE_DAYS).isBefore(now)) { s.setStatus("SUSPENDED"); subs.save(s); tell(s, "Your ChamaSmart plan is suspended", "New activity is paused until the plan is paid. All your records are safe and visible."); moved++; }
            } else {
                s.setStatus("PAST_DUE"); subs.save(s); moved++;
                tell(s, "Your ChamaSmart plan has ended", "Pay within " + GRACE_DAYS + " days to avoid a pause in new activity. All your records stay safe.");
            }
        }
        if (moved > 0) log.info("Subscription sweep moved {} chama(s)", moved);
        return moved;
    }

    private void tell(ChamaSubscription s, String title, String message) {
        try {
            chamas.findById(s.getChamaId()).ifPresent(c -> members.findByChamaChamaIdAndIsActiveTrue(c.getChamaId()).stream()
                    .filter(m -> "CHAIRPERSON".equalsIgnoreCase(m.getRole())).forEach(m ->
                            notifications.save(Notification.builder().user(m.getUser()).title(title).message(message).type("SUBSCRIPTION").entityType("CHAMA").entityId(c.getChamaId()).build())));
        } catch (Exception e) { log.warn("Could not notify about subscription change: {}", e.getMessage()); }
    }
}
