package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.Chama;
import com.chamasmart.backend.domain.ChamaAccountCode;
import com.chamasmart.backend.domain.MemberAccount;
import com.chamasmart.backend.domain.PaymentEvent;
import com.chamasmart.backend.repository.ChamaAccountCodeRepository;
import com.chamasmart.backend.repository.ChamaRepository;
import com.chamasmart.backend.repository.PaymentEventRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

/**
 * M-Pesa paybill and till payments (Daraja C2B). The account number the payer typed says who the money is for.
 * Order of defence: log the raw call first (one row per M-Pesa receipt), find the member by account number, check the
 * shortcode is the one that chama collects on, credit once, and park anything that does not line up.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class C2bService {
    private final PaymentEventRepository events;
    private final AccountNumberService accounts;
    private final ChamaAccountCodeRepository codes;
    private final ChamaRepository chamas;
    private final ContributionService contributions;
    private final com.chamasmart.backend.repository.ContributionRepository contributionRepo;
    private final TransactionTemplate tx;
    private final ObjectMapper json = new ObjectMapper();

    /** The shared paybill, used by chamas whose channel is POOLED. Empty until the pooled model is approved. */
    @Value("${app.mpesa.pooled-shortcode:}") private String pooledShortcode;

    /** Daraja asks whether to accept a payment before it takes the money (only if validation is enabled for the shortcode). */
    public boolean accepts(Map<String, Object> p) {
        return accounts.lookup(str(p, "BillRefNumber")).isPresent();
    }

    public void confirm(Map<String, Object> p) {
        String transId = str(p, "TransID");
        if (transId.isBlank()) { log.warn("C2B confirmation without a TransID ignored"); return; }
        BigDecimal amount;
        try { amount = new BigDecimal(str(p, "TransAmount")); } catch (Exception e) { amount = null; }
        String raw;
        try { raw = json.writeValueAsString(p); } catch (Exception e) { raw = p.toString(); }
        PaymentEvent ev = PaymentEvent.builder().provider("MPESA_C2B").providerEventId(transId).eventType("c2b.confirmation").status("RECEIVED")
                .amount(amount).currency("KES").payload(raw.length() > 20000 ? raw.substring(0, 20000) : raw).build();
        try { ev = events.saveAndFlush(ev); } catch (DataIntegrityViolationException dup) { return; }
        final Long id = ev.getEventId();
        try {
            tx.executeWithoutResult(s -> settle(id, p));
        } catch (Exception e) {
            log.error("C2B {} could not be settled: {}", transId, e.getMessage());
            events.findById(id).ifPresent(x -> { x.setStatus("UNMATCHED"); x.setNote(cut("Error while crediting: " + e.getMessage())); events.save(x); });
        }
    }

    private void settle(Long id, Map<String, Object> p) {
        PaymentEvent ev = events.findById(id).orElseThrow();
        String shortcode = str(p, "BusinessShortCode");
        String typed = str(p, "BillRefNumber");
        Optional<MemberAccount> acct = accounts.lookup(typed);
        if (acct.isEmpty()) {
            // Not a known account number; if the shortcode belongs to exactly one chama, show it to that chama's officials.
            codes.findFirstByShortcode(shortcode).ifPresent(c -> ev.setChamaId(c.getChamaId()));
            park(ev, "Account number \"" + cut(typed) + "\" is not valid or not known");
            return;
        }
        Long chamaId = acct.get().getChamaId();
        ev.setChamaId(chamaId);
        ChamaAccountCode code = codes.findById(chamaId).orElse(null);
        Chama chama = chamas.findById(chamaId).orElse(null);
        if (code == null || chama == null) { park(ev, "Chama not found"); return; }
        String expected = "POOLED".equals(code.getChannel()) ? pooledShortcode : code.getShortcode();
        if (expected == null || expected.isBlank() || !expected.equals(shortcode)) { park(ev, "Paid to shortcode " + shortcode + ", which this chama does not collect on"); return; }
        if (!"KES".equalsIgnoreCase(chama.getCurrency())) { park(ev, "Chama keeps its books in " + chama.getCurrency()); return; }
        if (ev.getAmount() == null || ev.getAmount().signum() <= 0) { park(ev, "Amount missing or not above zero"); return; }
        if (contributionRepo.existsByReferenceIgnoreCase("MPE" + ev.getProviderEventId())) { park(ev, "This M-Pesa code is already recorded as a contribution"); return; }
        try {
            var saved = contributions.creditProviderPayment(chamaId, acct.get().getUserId(),
                    new ContributionService.Entry(acct.get().getUserId(), ev.getAmount(), "MPE" + ev.getProviderEventId(), "REGULAR", "M-Pesa paybill payment to account " + acct.get().getAccountNumber(), null),
                    "MPE" + ev.getProviderEventId());
            ev.setStatus("CREDITED"); ev.setNote("Credited as contribution " + saved.getContribution_id());
            events.save(ev);
        } catch (IllegalArgumentException | IllegalStateException | org.springframework.security.access.AccessDeniedException e) {
            park(ev, e.getMessage());
        }
    }

    private void park(PaymentEvent ev, String why) {
        ev.setStatus("UNMATCHED"); ev.setNote(cut(why));
        events.save(ev);
        log.warn("C2B {} parked: {}", ev.getProviderEventId(), why);
    }

    private static String str(Map<String, Object> p, String k) { Object v = p.get(k); return v == null ? "" : v.toString().trim(); }
    private static String cut(String s) { return s == null ? null : s.length() > 290 ? s.substring(0, 290) : s; }
}
