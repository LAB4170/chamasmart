package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.Chama;
import com.chamasmart.backend.domain.PaymentEvent;
import com.chamasmart.backend.domain.PaymentIntent;
import com.chamasmart.backend.payments.PaystackProvider;
import com.chamasmart.backend.repository.ChamaRepository;
import com.chamasmart.backend.repository.PaymentEventRepository;
import com.chamasmart.backend.repository.PaymentIntentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.ZonedDateTime;

/**
 * Turns signed provider webhooks into credited payments, exactly once. Order of defence:
 * 1) signature must be valid, 2) the event id is recorded first (a retry hits the unique key and does nothing),
 * 3) the intent must exist, still be awaiting payment, and match in amount and currency, else the event is parked as UNMATCHED for a human.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentEventService {
    public enum Result { ACCEPTED, DUPLICATE, REJECTED }

    private final PaystackProvider paystack;
    private final PaymentEventRepository events;
    private final PaymentIntentRepository intents;
    private final ChamaRepository chamas;
    private final ContributionService contributions;
    private final TransactionTemplate tx;
    private final SubscriptionService subscriptions;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private BillingService billing;
    private final ObjectMapper json = new ObjectMapper();

    public Result handlePaystack(String rawBody, String signature) {
        if (!paystack.validSignature(rawBody, signature)) { log.warn("Paystack webhook with a bad signature refused"); return Result.REJECTED; }
        JsonNode root;
        try { root = json.readTree(rawBody); } catch (Exception e) { return Result.REJECTED; }
        String type = root.path("event").asText("");
        JsonNode data = root.path("data");
        String id = data.path("id").asText("");
        if (type.isBlank() || id.isBlank()) return Result.REJECTED;
        String eventId = type + ":" + id;

        PaymentEvent ev = PaymentEvent.builder().provider("PAYSTACK").providerEventId(eventId).eventType(type).status("RECEIVED")
                .amount(data.has("amount") ? BigDecimal.valueOf(data.path("amount").asLong()).movePointLeft(2) : null)
                .currency(data.path("currency").asText(null)).payload(rawBody.length() > 20000 ? rawBody.substring(0, 20000) : rawBody)
                .intentId(data.path("metadata").path("intent_id").isNumber() ? data.path("metadata").path("intent_id").asLong() : null).build();
        try { ev = events.saveAndFlush(ev); } catch (DataIntegrityViolationException dup) { return Result.DUPLICATE; }

        if (!"charge.success".equals(type)) { finish(ev.getEventId(), "IGNORED", "Event type not handled", null); return Result.ACCEPTED; }
        final Long eid = ev.getEventId();
        try {
            tx.executeWithoutResult(s -> settle(eid, data));
        } catch (Exception e) {
            log.error("Paystack event {} could not be settled: {}", eventId, e.getMessage());
            finish(eid, "UNMATCHED", "Error while crediting: " + abbreviate(e.getMessage()), null);
        }
        return Result.ACCEPTED;
    }

    private void settle(Long eventDbId, JsonNode data) {
        PaymentEvent ev = events.findById(eventDbId).orElseThrow();
        Long intentId = ev.getIntentId();
        String ref = data.path("reference").asText("");
        if (ref.startsWith("SUB-")) { settleSubscription(ev, data, ref); return; }
        if (intentId == null || !ref.startsWith("CS-" + intentId + "-")) { park(ev, "Payment does not point at one of our intents"); return; }
        PaymentIntent i = intents.findById(intentId).orElse(null);
        if (i == null) { park(ev, "Intent " + intentId + " not found"); return; }
        ev.setChamaId(i.getChamaId());
        Chama chama = chamas.findById(i.getChamaId()).orElse(null);
        if (chama == null) { park(ev, "Chama not found"); return; }
        if (!"PAYSTACK".equals(i.getProvider())) { park(ev, "Intent was not created for card checkout"); return; }
        if (!"AWAITING_PAYMENT".equals(i.getStatus())) { park(ev, "Intent is " + i.getStatus() + "; money received but not credited"); return; }
        if (ev.getAmount() == null || ev.getAmount().compareTo(i.getAmount()) != 0) { park(ev, "Amount " + ev.getAmount() + " differs from the expected " + i.getAmount()); return; }
        if (ev.getCurrency() == null || !ev.getCurrency().equalsIgnoreCase(chama.getCurrency())) { park(ev, "Currency " + ev.getCurrency() + " differs from the chama's " + chama.getCurrency()); return; }
        String type = switch (i.getPurpose()) { case "FINE" -> "FINE"; case "WELFARE" -> "WELFARE"; default -> "REGULAR"; };
        var saved = contributions.creditProviderPayment(i.getChamaId(), i.getUserId(),
                new ContributionService.Entry(i.getUserId(), i.getAmount(), ref, type, "Card/M-Pesa checkout, intent " + i.getIntentId(), null), ref);
        i.setContributionId(saved.getContribution_id());
        i.setStatus("SUBMITTED");
        intents.save(i);
        ev.setStatus("CREDITED"); ev.setNote("Credited as contribution " + saved.getContribution_id());
        events.save(ev);
    }

    /** A chama paying its platform plan. This is ChamaSmart's own revenue: it is never posted to a chama's journal. */
    private void settleSubscription(PaymentEvent ev, JsonNode data, String ref) {
        JsonNode md = data.path("metadata");
        Long chamaId = md.path("chama_id").isNumber() ? md.path("chama_id").asLong() : null;
        String plan = md.path("plan_code").asText("");
        if (chamaId == null || plan.isBlank() || !ref.startsWith("SUB-" + chamaId + "-")) { park(ev, "Subscription payment does not point at a chama and plan"); return; }
        ev.setChamaId(chamaId);
        String problem = subscriptions.activateFromPayment(chamaId, plan, ev.getAmount(), ev.getCurrency(), ref);
        if (problem != null) { park(ev, problem); return; }
        if (billing != null) billing.recordInvoice(chamaId, plan, ev.getAmount(), ev.getCurrency(), ref);
        ev.setStatus("CREDITED"); ev.setNote("Plan " + plan + " paid");
        events.save(ev);
    }

    private void park(PaymentEvent ev, String why) {
        log.warn("Payment event {} parked: {}", ev.getProviderEventId(), why);
        ev.setStatus("UNMATCHED"); ev.setNote(abbreviate(why));
        events.save(ev);
    }

    private void finish(Long id, String status, String note, Long chamaId) {
        events.findById(id).ifPresent(e -> { e.setStatus(status); e.setNote(abbreviate(note)); if (chamaId != null) e.setChamaId(chamaId); events.save(e); });
    }

    private static String abbreviate(String s) { return s == null ? null : s.length() > 290 ? s.substring(0, 290) : s; }
}
