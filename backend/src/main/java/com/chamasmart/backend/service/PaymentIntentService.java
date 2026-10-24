package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.payments.PaymentProvider;
import com.chamasmart.backend.repository.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.ZonedDateTime;
import java.util.*;

/** The payment workflow: choose a provider, create an intent, submit the reference, and follow it to verified. */
@Service
public class PaymentIntentService {
    private static final Map<String, String> PURPOSE_TO_TYPE = Map.of("CONTRIBUTION", "REGULAR", "FINE", "FINE", "WELFARE", "WELFARE");
    private static final BigDecimal MAX = new BigDecimal("10000000");

    private final PaymentIntentRepository intents;
    private final ChamaRepository chamas;
    private final ChamaMemberRepository members;
    private final ContributionRepository contributions;
    private final ContributionService contributionService;
    private final Map<String, PaymentProvider> providers = new LinkedHashMap<>();

    public PaymentIntentService(PaymentIntentRepository intents, ChamaRepository chamas, ChamaMemberRepository members,
                                ContributionRepository contributions, ContributionService contributionService, List<PaymentProvider> all) {
        this.intents = intents; this.chamas = chamas; this.members = members; this.contributions = contributions; this.contributionService = contributionService;
        all.forEach(p -> providers.put(p.code(), p));
    }

    public List<Map<String, Object>> providers() {
        return providers.values().stream().map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", p.code()); m.put("name", p.displayName()); m.put("available", p.isConfigured());
            m.put("confirms_automatically", p.confirmsAutomatically());
            return m;
        }).toList();
    }

    private void activeMember(Long chamaId, Long userId) {
        members.findByChamaChamaIdAndUserUserId(chamaId, userId).filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new AccessDeniedException("You are not an active member of this chama"));
    }

    @Transactional
    public Map<String, Object> create(Long chamaId, Long userId, String purpose, BigDecimal amount, String providerCode, String idempotencyKey) {
        activeMember(chamaId, userId);
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 64) throw new IllegalArgumentException("A request key of 1 to 64 characters is required");
        Optional<PaymentIntent> again = intents.findByUserIdAndIdempotencyKey(userId, idempotencyKey);
        if (again.isPresent()) return view(again.get(), null);
        String p = purpose == null ? "" : purpose.trim().toUpperCase();
        if (!PURPOSE_TO_TYPE.containsKey(p)) throw new IllegalArgumentException("Choose what you are paying for: contribution, fine or welfare");
        if (amount == null || amount.signum() <= 0 || amount.compareTo(MAX) > 0) throw new IllegalArgumentException("Enter an amount above zero");
        PaymentProvider provider = providers.get(providerCode == null || providerCode.isBlank() ? "MANUAL" : providerCode.trim().toUpperCase());
        if (provider == null || !provider.isConfigured()) throw new IllegalStateException("That way of paying is not available yet");
        Chama chama = chamas.findById(chamaId).orElseThrow(() -> new IllegalArgumentException("Chama not found"));
        PaymentIntent saved = intents.save(PaymentIntent.builder().chamaId(chamaId).userId(userId).purpose(p).amount(amount.setScale(2, RoundingMode.HALF_UP))
                .provider(provider.code()).idempotencyKey(idempotencyKey).expiresAt(ZonedDateTime.now().plusHours(24)).build());
        return view(saved, provider.instructions(chama.getChamaName(), saved.getAmount()));
    }

    /** The member reports they paid. This only creates a pending contribution; an official still has to verify it. */
    @Transactional
    public Map<String, Object> submit(Long chamaId, Long userId, Long intentId, String reference, String proof) {
        PaymentIntent i = mine(chamaId, userId, intentId);
        refreshExpiry(i);
        if (!"AWAITING_PAYMENT".equals(i.getStatus())) throw new IllegalStateException("This payment is " + i.getStatus().toLowerCase().replace('_', ' ') + " and cannot be submitted");
        var saved = contributionService.submit(chamaId, userId, new ContributionService.Entry(userId, i.getAmount(), reference, PURPOSE_TO_TYPE.get(i.getPurpose()), "Payment intent " + i.getIntentId(), proof));
        i.setContributionId(saved.getContribution_id());
        i.setStatus("SUBMITTED");
        intents.save(i);
        return view(i, null);
    }

    @Transactional
    public Map<String, Object> cancel(Long chamaId, Long userId, Long intentId) {
        PaymentIntent i = mine(chamaId, userId, intentId);
        if (!"AWAITING_PAYMENT".equals(i.getStatus())) throw new IllegalStateException("Only a payment that has not been submitted can be cancelled");
        i.setStatus("CANCELLED");
        intents.save(i);
        return view(i, null);
    }

    @Transactional
    public List<Map<String, Object>> mineList(Long chamaId, Long userId) {
        activeMember(chamaId, userId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (PaymentIntent i : intents.findByChamaIdAndUserIdOrderByCreatedAtDesc(chamaId, userId)) { refreshExpiry(i); out.add(view(i, null)); }
        return out;
    }

    private PaymentIntent mine(Long chamaId, Long userId, Long intentId) {
        activeMember(chamaId, userId);
        return intents.findById(intentId).filter(i -> i.getChamaId().equals(chamaId) && i.getUserId().equals(userId)).orElseThrow(() -> new IllegalArgumentException("Payment not found"));
    }

    private void refreshExpiry(PaymentIntent i) {
        if ("AWAITING_PAYMENT".equals(i.getStatus()) && i.getExpiresAt().isBefore(ZonedDateTime.now())) { i.setStatus("EXPIRED"); intents.save(i); }
    }

    /** CONFIRMED and FAILED are never stored: they come from the contribution an official verified or rejected. */
    static String effectiveStatus(PaymentIntent i, String contributionStatus) {
        if (!"SUBMITTED".equals(i.getStatus()) || contributionStatus == null) return i.getStatus();
        return switch (contributionStatus.toUpperCase()) { case "COMPLETED" -> "CONFIRMED"; case "FAILED", "REJECTED" -> "FAILED"; default -> "SUBMITTED"; };
    }

    private Map<String, Object> view(PaymentIntent i, String instructions) {
        String cs = i.getContributionId() == null ? null : contributions.findById(i.getContributionId()).map(Contribution::getStatus).orElse(null);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("intent_id", i.getIntentId()); m.put("purpose", i.getPurpose()); m.put("amount", i.getAmount()); m.put("provider", i.getProvider());
        m.put("status", effectiveStatus(i, cs)); m.put("expires_at", i.getExpiresAt()); m.put("created_at", i.getCreatedAt());
        if (instructions != null) m.put("instructions", instructions);
        return m;
    }
}
