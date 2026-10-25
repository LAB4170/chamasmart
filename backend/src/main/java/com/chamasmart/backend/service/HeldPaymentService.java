package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.PaymentEvent;
import com.chamasmart.backend.repository.ChamaMemberRepository;
import com.chamasmart.backend.repository.ContributionRepository;
import com.chamasmart.backend.repository.PaymentEventRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/** Money that arrived but could not be credited by itself. Officials give it to the right member or record how it was dealt with. */
@Service
@RequiredArgsConstructor
public class HeldPaymentService {
    private final PaymentEventRepository events;
    private final MembershipService membership;
    private final ChamaMemberRepository members;
    private final ContributionService contributions;
    private final ContributionRepository contributionRepo;
    private final ObjectMapper json = new ObjectMapper();

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(Long chamaId, Long actorId) {
        membership.activeOfficial(chamaId, actorId);
        return events.findByChamaIdAndStatusOrderByReceivedAtDesc(chamaId, "UNMATCHED").stream().map(this::view).toList();
    }

    /** Platform operator view: money that could not be tied to any chama. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> listUnrouted() {
        return events.findByChamaIdIsNullAndStatusOrderByReceivedAtDesc("UNMATCHED").stream().map(this::view).toList();
    }

    @Transactional
    public Map<String, Object> assign(Long chamaId, Long actorId, Long eventId, Long userId) {
        membership.activeOfficial(chamaId, actorId);
        PaymentEvent ev = load(chamaId, eventId);
        if (actorId.equals(userId)) throw new AccessDeniedException("You cannot assign held money to yourself; ask another official");
        members.findByChamaChamaIdAndUserUserId(chamaId, userId).filter(m -> Boolean.TRUE.equals(m.getIsActive()))
                .orElseThrow(() -> new IllegalArgumentException("That person is not an active member of this chama"));
        String ref = "MPE" + ev.getProviderEventId();
        if (contributionRepo.existsByReferenceIgnoreCase(ref)) throw new IllegalStateException("This M-Pesa code is already recorded as a contribution");
        var saved = contributions.creditProviderPayment(chamaId, userId,
                new ContributionService.Entry(userId, ev.getAmount(), ref, "REGULAR", "Held payment assigned by official " + actorId, null), ref);
        ev.setStatus("CREDITED"); ev.setNote("Assigned by official " + actorId + " as contribution " + saved.getContribution_id());
        events.save(ev);
        return view(ev);
    }

    /** For money that was returned, belongs elsewhere, or was handled outside the app. A reason is required and kept. */
    @Transactional
    public Map<String, Object> resolve(Long chamaId, Long actorId, Long eventId, String reason) {
        membership.activeOfficial(chamaId, actorId);
        if (reason == null || reason.isBlank()) throw new IllegalArgumentException("Say how this was dealt with");
        PaymentEvent ev = load(chamaId, eventId);
        ev.setStatus("RESOLVED"); ev.setNote(("Resolved by official " + actorId + ": " + reason.trim()).substring(0, Math.min(290, ("Resolved by official " + actorId + ": " + reason.trim()).length())));
        events.save(ev);
        return view(ev);
    }

    private PaymentEvent load(Long chamaId, Long eventId) {
        PaymentEvent ev = events.findById(eventId).filter(e -> chamaId.equals(e.getChamaId())).orElseThrow(() -> new IllegalArgumentException("Payment not found"));
        if (!"UNMATCHED".equals(ev.getStatus())) throw new IllegalStateException("This payment is already " + ev.getStatus().toLowerCase());
        return ev;
    }

    private Map<String, Object> view(PaymentEvent e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("event_id", e.getEventId()); m.put("provider", e.getProvider()); m.put("reference", e.getProviderEventId());
        m.put("amount", e.getAmount()); m.put("currency", e.getCurrency()); m.put("status", e.getStatus()); m.put("reason", e.getNote());
        m.put("received_at", e.getReceivedAt());
        try {
            JsonNode n = json.readTree(e.getPayload() == null ? "{}" : e.getPayload());
            m.put("account_typed", n.path("BillRefNumber").asText(null));
            m.put("payer_phone", n.path("MSISDN").asText(null));
            m.put("payer_name", (n.path("FirstName").asText("") + " " + n.path("LastName").asText("")).trim());
        } catch (Exception ignored) { }
        return m;
    }
}
