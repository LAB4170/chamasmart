package com.chamasmart.backend.service;

import com.chamasmart.backend.repository.ContributionRepository;
import com.chamasmart.backend.repository.PaymentEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

/**
 * The finance desk. The accountant proposes; a person holding FINANCE_APPROVE (super admin) decides. Nothing here moves money out
 * of an account: returns and refunds are made in the M-Pesa or Paystack dashboard and the reference is recorded afterwards.
 * Every step is written to the activity log in the same transaction.
 */
@Service
@RequiredArgsConstructor
public class FinanceService {
    private final JdbcTemplate jdbc;
    private final AdminGuard guard;
    private final PaymentEventRepository events;
    private final ContributionService contributions;
    private final ContributionRepository contributionRepo;
    private final BillingService billing;

    // ---------- reading ----------

    public Map<String, Object> overview() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("unrouted_payments", n("SELECT count(*) FROM payment_events WHERE chama_id IS NULL AND status = 'UNMATCHED'"));
        m.put("requests_waiting", n("SELECT count(*) FROM finance_requests WHERE status = 'PROPOSED'"));
        m.put("refunds_to_send", n("SELECT count(*) FROM finance_requests WHERE status = 'APPROVED'"));
        m.put("past_due_plans", n("SELECT count(*) FROM (SELECT DISTINCT ON (chama_id) status FROM chama_subscriptions ORDER BY chama_id, subscription_id DESC) x WHERE status IN ('PAST_DUE','SUSPENDED')"));
        m.put("months", jdbc.queryForList("""
                SELECT to_char(date_trunc('month', issued_at), 'YYYY-MM') AS month, count(*) AS invoices, sum(gross) AS gross, sum(net) AS net, sum(vat) AS vat
                FROM platform_invoices GROUP BY 1 ORDER BY 1 DESC LIMIT 12"""));
        m.put("refunded", jdbc.queryForList("""
                SELECT to_char(date_trunc('month', done_at), 'YYYY-MM') AS month, sum(amount) AS refunded
                FROM finance_requests WHERE kind = 'REFUND' AND status = 'DONE' GROUP BY 1 ORDER BY 1 DESC LIMIT 12"""));
        return m;
    }

    public List<Map<String, Object>> subscriptions() {
        return jdbc.queryForList("""
                SELECT s.chama_id, c.chama_name, s.plan_code, s.status, s.current_period_end,
                       (SELECT count(*) FROM chama_members m WHERE m.chama_id = s.chama_id AND m.is_active = true) AS members,
                       p.price, p.currency
                FROM (SELECT DISTINCT ON (chama_id) * FROM chama_subscriptions ORDER BY chama_id, subscription_id DESC) s
                JOIN chamas c ON c.chama_id = s.chama_id LEFT JOIN subscription_plans p ON p.plan_code = s.plan_code
                ORDER BY CASE s.status WHEN 'SUSPENDED' THEN 0 WHEN 'PAST_DUE' THEN 1 ELSE 2 END, s.current_period_end NULLS LAST LIMIT 500""");
    }

    public List<Map<String, Object>> invoices(LocalDate from, LocalDate to) {
        return jdbc.queryForList("""
                SELECT i.invoice_id, i.invoice_number, i.chama_id, c.chama_name, i.plan_code, i.gross, i.net, i.vat, i.currency, i.reference, i.issued_at,
                       coalesce((SELECT sum(r.amount) FROM finance_requests r WHERE r.invoice_id = i.invoice_id AND r.kind = 'REFUND' AND r.status = 'DONE'), 0) AS refunded
                FROM platform_invoices i LEFT JOIN chamas c ON c.chama_id = i.chama_id
                WHERE i.issued_at >= ? AND i.issued_at < ? ORDER BY i.issued_at DESC LIMIT 1000""", from, to.plusDays(1));
    }

    public List<Map<String, Object>> requests(String status) {
        String sql = """
                SELECT r.*, p.first_name || ' ' || p.last_name AS proposed_by_name, d.first_name || ' ' || d.last_name AS decided_by_name
                FROM finance_requests r JOIN users p ON p.user_id = r.proposed_by LEFT JOIN users d ON d.user_id = r.decided_by""";
        return status == null || status.isBlank()
                ? jdbc.queryForList(sql + " ORDER BY r.request_id DESC LIMIT 300")
                : jdbc.queryForList(sql + " WHERE r.status = ? ORDER BY r.request_id DESC LIMIT 300", status.toUpperCase());
    }

    /** Invoices less completed refunds, as CSV for the accountant. Refunds appear as credit lines in the month they were sent. */
    public String vatCsv(LocalDate from, LocalDate to) {
        StringBuilder sb = new StringBuilder("type,number,date,chama_id,chama,plan,currency,net,vat,gross,reference\n");
        BigDecimal net = BigDecimal.ZERO, vat = BigDecimal.ZERO, gross = BigDecimal.ZERO;
        for (var r : jdbc.queryForList("""
                SELECT i.*, c.chama_name FROM platform_invoices i LEFT JOIN chamas c ON c.chama_id = i.chama_id
                WHERE i.issued_at >= ? AND i.issued_at < ? ORDER BY i.issued_at""", from, to.plusDays(1))) {
            BigDecimal a = (BigDecimal) r.get("net"), b = (BigDecimal) r.get("vat"), g = (BigDecimal) r.get("gross");
            net = net.add(a); vat = vat.add(b); gross = gross.add(g);
            sb.append(line("INVOICE", r.get("invoice_number"), day(r.get("issued_at")), r.get("chama_id"), r.get("chama_name"), r.get("plan_code"), r.get("currency"), a, b, g, r.get("reference")));
        }
        for (var r : jdbc.queryForList("""
                SELECT f.request_id, f.amount, f.done_at, f.external_ref, i.invoice_number, i.chama_id, i.plan_code, i.currency, i.gross, i.vat, c.chama_name
                FROM finance_requests f JOIN platform_invoices i ON i.invoice_id = f.invoice_id LEFT JOIN chamas c ON c.chama_id = i.chama_id
                WHERE f.kind = 'REFUND' AND f.status = 'DONE' AND f.done_at >= ? AND f.done_at < ? ORDER BY f.done_at""", from, to.plusDays(1))) {
            BigDecimal amt = (BigDecimal) r.get("amount"), g = (BigDecimal) r.get("gross"), v = (BigDecimal) r.get("vat");
            BigDecimal rv = g.signum() == 0 ? BigDecimal.ZERO : amt.multiply(v).divide(g, 2, RoundingMode.HALF_UP);
            BigDecimal rn = amt.subtract(rv);
            net = net.subtract(rn); vat = vat.subtract(rv); gross = gross.subtract(amt);
            sb.append(line("CREDIT_NOTE", "CN-" + r.get("request_id") + " for " + r.get("invoice_number"), day(r.get("done_at")), r.get("chama_id"), r.get("chama_name"), r.get("plan_code"), r.get("currency"), rn.negate(), rv.negate(), amt.negate(), r.get("external_ref")));
        }
        sb.append(line("TOTAL", "", from + " to " + to, "", "", "", "", net, vat, gross, ""));
        return sb.toString();
    }

    // ---------- proposing ----------

    /** Give money that reached the paybill without a chama to the member it belongs to. Credited only after approval. */
    @Transactional
    public Map<String, Object> proposeAssign(Long actor, Long eventId, Long chamaId, Long userId, String reason) {
        reason = reason(reason);
        var ev = events.findById(eventId == null ? -1L : eventId).orElseThrow(() -> new IllegalArgumentException("Payment not found"));
        jdbc.queryForList("SELECT event_id FROM payment_events WHERE event_id = ? FOR UPDATE", eventId);
        if (ev.getChamaId() != null || !"UNMATCHED".equals(ev.getStatus())) throw new IllegalStateException("This payment is not waiting for a chama");
        if (ev.getProvider() == null || !ev.getProvider().toUpperCase().startsWith("MPESA"))
            throw new IllegalStateException("Only M-Pesa payments can be assigned to a member");
        Integer ok = jdbc.queryForObject("SELECT count(*) FROM chama_members WHERE chama_id = ? AND user_id = ? AND is_active = true", Integer.class, chamaId, userId);
        if (ok == null || ok == 0) throw new IllegalArgumentException("That person is not an active member of that chama");
        long id = insert("ASSIGN_PAYMENT", eventId, null, chamaId, userId, ev.getAmount(), ev.getCurrency(), reason, actor);
        guard.log(actor, "FIN_ASSIGN_PROPOSED", chamaId, "request " + id + ": payment " + ev.getProviderEventId() + " " + ev.getAmount() + " to user " + userId);
        return one(id);
    }

    /** Money no member can be found for goes back to the sender. The return itself is done in the M-Pesa portal. */
    @Transactional
    public Map<String, Object> proposeReturn(Long actor, Long eventId, String reason) {
        reason = reason(reason);
        var ev = events.findById(eventId == null ? -1L : eventId).orElseThrow(() -> new IllegalArgumentException("Payment not found"));
        jdbc.queryForList("SELECT event_id FROM payment_events WHERE event_id = ? FOR UPDATE", eventId);
        if (ev.getChamaId() != null || !"UNMATCHED".equals(ev.getStatus())) throw new IllegalStateException("This payment is not waiting for a chama");
        long id = insert("RETURN_PAYMENT", eventId, null, null, null, ev.getAmount(), ev.getCurrency(), reason, actor);
        guard.log(actor, "FIN_RETURN_PROPOSED", null, "request " + id + ": return payment " + ev.getProviderEventId() + " " + ev.getAmount());
        return one(id);
    }

    @Transactional
    public Map<String, Object> proposeRefund(Long actor, Long invoiceId, BigDecimal amount, String reason) {
        reason = reason(reason);
        var inv = jdbc.queryForList("SELECT invoice_id, chama_id, gross, currency FROM platform_invoices WHERE invoice_id = ? FOR SHARE", invoiceId);
        if (inv.isEmpty()) throw new IllegalArgumentException("Invoice not found");
        BigDecimal gross = (BigDecimal) inv.get(0).get("gross");
        if (amount == null || amount.signum() <= 0) throw new IllegalArgumentException("Enter the amount to refund");
        amount = amount.setScale(2, RoundingMode.HALF_UP);
        jdbc.queryForList("SELECT invoice_id FROM platform_invoices WHERE invoice_id = ?", invoiceId);
        BigDecimal committed = jdbc.queryForObject("SELECT coalesce(sum(amount),0) FROM finance_requests WHERE invoice_id = ? AND kind = 'REFUND' AND status IN ('PROPOSED','APPROVED','DONE')", BigDecimal.class, invoiceId);
        if (committed.add(amount).compareTo(gross) > 0) throw new IllegalStateException("Refunds on this invoice would exceed what was paid (" + gross + "; already requested " + committed + ")");
        Long chamaId = ((Number) inv.get(0).get("chama_id")).longValue();
        long id = insert("REFUND", null, invoiceId, chamaId, null, amount, (String) inv.get(0).get("currency"), reason, actor);
        guard.log(actor, "FIN_REFUND_PROPOSED", chamaId, "request " + id + ": refund " + amount + " on invoice " + invoiceId);
        return one(id);
    }

    // ---------- deciding ----------

    @Transactional
    public Map<String, Object> approve(Long actor, Long id) {
        var r = lock(id, "PROPOSED");
        if (guard.twoPerson() && actor.equals(((Number) r.get("proposed_by")).longValue())) throw new AccessDeniedException("A different approver must decide this; you proposed it");
        String kind = (String) r.get("kind");
        if ("ASSIGN_PAYMENT".equals(kind)) {
            Long eventId = ((Number) r.get("event_id")).longValue(), chamaId = ((Number) r.get("chama_id")).longValue(), userId = ((Number) r.get("user_id")).longValue();
            var ev = events.findById(eventId).orElseThrow();
            if (ev.getChamaId() != null || !"UNMATCHED".equals(ev.getStatus())) throw new IllegalStateException("This payment has already been dealt with");
            String ref = "MPE" + ev.getProviderEventId();
            if (contributionRepo.existsByReferenceIgnoreCase(ref)) throw new IllegalStateException("This M-Pesa code is already recorded as a contribution");
            ev.setChamaId(chamaId);
            var saved = contributions.creditProviderPayment(chamaId, userId, new ContributionService.Entry(userId, ev.getAmount(), ref, "REGULAR", "Unclaimed payment assigned by ChamaSmart finance, request " + id, null), ref);
            ev.setStatus("CREDITED"); ev.setNote("Assigned by finance request " + id + " as contribution " + saved.getContribution_id());
            events.save(ev);
            jdbc.update("UPDATE finance_requests SET status = 'DONE', decided_by = ?, decided_at = now(), done_by = ?, done_at = now() WHERE request_id = ?", actor, actor, id);
            guard.log(actor, "FIN_ASSIGN_APPROVED", chamaId, "request " + id + ": credited " + ev.getAmount() + " to user " + userId);
        } else {
            jdbc.update("UPDATE finance_requests SET status = 'APPROVED', decided_by = ?, decided_at = now() WHERE request_id = ?", actor, id);
            guard.log(actor, "FIN_" + kind + "_APPROVED", (Long) r.get("chama_id"), "request " + id + " approved; money to be sent from the provider dashboard");
        }
        return one(id);
    }

    @Transactional
    public Map<String, Object> reject(Long actor, Long id, String note) {
        var r = lock(id, "PROPOSED");
        jdbc.update("UPDATE finance_requests SET status = 'REJECTED', decided_by = ?, decided_at = now(), decision_note = ? WHERE request_id = ?", actor, reason(note), id);
        guard.log(actor, "FIN_" + r.get("kind") + "_REJECTED", (Long) r.get("chama_id"), "request " + id);
        return one(id);
    }

    @Transactional
    public Map<String, Object> cancel(Long actor, Long id) {
        var r = lock(id, "PROPOSED");
        if (!actor.equals(((Number) r.get("proposed_by")).longValue())) throw new AccessDeniedException("Only the person who proposed this can withdraw it");
        jdbc.update("UPDATE finance_requests SET status = 'CANCELLED', decided_by = ?, decided_at = now() WHERE request_id = ?", actor, id);
        guard.log(actor, "FIN_" + r.get("kind") + "_WITHDRAWN", (Long) r.get("chama_id"), "request " + id);
        return one(id);
    }

    /** After an approved return or refund has been sent from the provider dashboard, record its reference to close it. */
    @Transactional
    public Map<String, Object> complete(Long actor, Long id, String externalRef) {
        var r = lock(id, "APPROVED");
        if (externalRef == null || externalRef.trim().length() < 4) throw new IllegalArgumentException("Enter the provider's reference for the money that was sent");
        jdbc.update("UPDATE finance_requests SET status = 'DONE', external_ref = ?, done_by = ?, done_at = now() WHERE request_id = ?", externalRef.trim(), actor, id);
        if ("RETURN_PAYMENT".equals(r.get("kind"))) {
            var ev = events.findById(((Number) r.get("event_id")).longValue()).orElseThrow();
            ev.setStatus("RESOLVED"); ev.setNote("Returned to sender, ref " + externalRef.trim());
            events.save(ev);
        }
        guard.log(actor, "FIN_" + r.get("kind") + "_SENT", (Long) r.get("chama_id"), "request " + id + " sent, ref " + externalRef.trim());
        return one(id);
    }

    // ---------- helpers ----------

    private Map<String, Object> lock(Long id, String expected) {
        var l = jdbc.queryForList("SELECT * FROM finance_requests WHERE request_id = ? FOR UPDATE", id);
        if (l.isEmpty()) throw new IllegalArgumentException("Request not found");
        if (!expected.equals(l.get(0).get("status"))) throw new IllegalStateException("This request is " + String.valueOf(l.get(0).get("status")).toLowerCase() + ", not " + expected.toLowerCase());
        return l.get(0);
    }

    private long insert(String kind, Long eventId, Long invoiceId, Long chamaId, Long userId, BigDecimal amount, String currency, String reason, Long actor) {
        try {
            return jdbc.queryForObject("""
                    INSERT INTO finance_requests (kind, event_id, invoice_id, chama_id, user_id, amount, currency, reason, proposed_by)
                    VALUES (?,?,?,?,?,?,?,?,?) RETURNING request_id""", Long.class, kind, eventId, invoiceId, chamaId, userId, amount, currency == null ? "KES" : currency, reason, actor);
        } catch (org.springframework.dao.DuplicateKeyException e) {
            throw new IllegalStateException("There is already an open request for this payment");
        }
    }

    private Map<String, Object> one(long id) { return requests(null).stream().filter(x -> ((Number) x.get("request_id")).longValue() == id).findFirst().orElseThrow(); }
    private String reason(String s) {
        if (s == null || s.trim().length() < 10) throw new IllegalArgumentException("Write the reason (at least 10 characters)");
        return s.trim().length() > 500 ? s.trim().substring(0, 500) : s.trim();
    }
    private long n(String sql) { Long v = jdbc.queryForObject(sql, Long.class); return v == null ? 0 : v; }
    private String day(Object ts) { return ts == null ? "" : ts.toString().substring(0, 10); }
    private String line(Object... c) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < c.length; i++) { if (i > 0) sb.append(','); sb.append(cell(c[i])); }
        return sb.append('\n').toString();
    }
    /** CSV-safe, and safe against spreadsheet formulas in text a user could have typed (chama names). */
    private String cell(Object o) {
        String s = o == null ? "" : o.toString();
        if (!s.isEmpty() && "=+-@\t\r".indexOf(s.charAt(0)) >= 0 && !(o instanceof BigDecimal)) s = "'" + s;
        return s.contains(",") || s.contains("\"") || s.contains("\n") ? "\"" + s.replace("\"", "\"\"") + "\"" : s;
    }
}
