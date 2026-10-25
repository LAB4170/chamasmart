package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.Contribution;
import com.chamasmart.backend.domain.PaymentEvent;
import com.chamasmart.backend.domain.ReconciliationRun;
import com.chamasmart.backend.repository.ContributionRepository;
import com.chamasmart.backend.repository.PaymentEventRepository;
import com.chamasmart.backend.repository.ReconciliationRunRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

/**
 * Compares an M-Pesa statement with the chama's books, line by line. The statement is the bank's word for what really arrived;
 * every line must be either a credited contribution, a payment held for a decision, or a visible break.
 */
@Service
@RequiredArgsConstructor
public class ReconciliationService {
    static final int MAX_LINES = 5000;

    private final MembershipService membership;
    private final ContributionRepository contributions;
    private final PaymentEventRepository events;
    private final ReconciliationRunRepository runs;

    public record Line(String receipt, BigDecimal amount) {}

    @Transactional
    public Map<String, Object> reconcile(Long chamaId, Long actorId, String csv) {
        membership.activeOfficial(chamaId, actorId);
        List<Line> lines = parse(csv);
        if (lines.isEmpty()) throw new IllegalArgumentException("No payments were found in that statement. Upload the M-Pesa statement as a CSV file with Receipt No. and Paid In columns.");
        if (lines.size() > MAX_LINES) throw new IllegalArgumentException("A statement can hold at most " + MAX_LINES + " payments; split it by date");

        Set<String> refs = new HashSet<>();
        for (Line l : lines) { refs.add(l.receipt()); refs.add("MPE" + l.receipt()); }
        Map<String, Contribution> byRef = new HashMap<>();
        for (Contribution c : contributions.findByReferences(chamaId, refs)) byRef.put(c.getReference().toUpperCase(), c);

        List<Map<String, Object>> breaks = new ArrayList<>();
        int matched = 0, missing = 0, held = 0, differs = 0, pending = 0;
        BigDecimal total = BigDecimal.ZERO;
        for (Line l : lines) {
            total = total.add(l.amount());
            Contribution c = byRef.getOrDefault(l.receipt(), byRef.get("MPE" + l.receipt()));
            if (c != null) {
                String st = c.getStatus() == null ? "" : c.getStatus().toUpperCase();
                if ("COMPLETED".equals(st)) {
                    if (c.getAmount().compareTo(l.amount()) == 0) { matched++; continue; }
                    differs++;
                    breaks.add(brk(l, "AMOUNT_DIFFERS", "The statement says " + l.amount() + " but the books say " + c.getAmount()));
                } else if ("PENDING".equals(st)) {
                    pending++;
                    breaks.add(brk(l, "PENDING", "Recorded but not verified yet"));
                } else {
                    missing++;
                    breaks.add(brk(l, "MISSING", "A contribution with this code exists but is " + st.toLowerCase()));
                }
                continue;
            }
            Optional<PaymentEvent> ev = events.findByProviderAndProviderEventId("MPESA_C2B", l.receipt());
            if (ev.isPresent() && chamaId.equals(ev.get().getChamaId()) && "UNMATCHED".equals(ev.get().getStatus())) {
                held++;
                breaks.add(brk(l, "HELD", "Arrived but held for an official's decision"));
            } else {
                missing++;
                breaks.add(brk(l, "MISSING", "On the statement but not in the books"));
            }
        }
        boolean ok = missing == 0 && held == 0 && differs == 0 && pending == 0;
        ReconciliationRun run = runs.save(ReconciliationRun.builder().chamaId(chamaId).runBy(actorId).statementLines(lines.size()).statementTotal(total)
                .matched(matched).missing(missing).held(held).amountDiffers(differs).pending(pending).reconciled(ok).build());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("run_id", run.getRunId());
        out.put("reconciled", ok);
        out.put("statement_lines", lines.size()); out.put("statement_total", total);
        out.put("matched", matched); out.put("missing", missing); out.put("held", held); out.put("amount_differs", differs); out.put("pending", pending);
        out.put("breaks", breaks.size() > 200 ? breaks.subList(0, 200) : breaks);
        return out;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> latest(Long chamaId, Long actorId) {
        membership.activeOfficial(chamaId, actorId);
        Map<String, Object> m = new LinkedHashMap<>();
        runs.findFirstByChamaIdOrderByRunAtDesc(chamaId).ifPresentOrElse(r -> {
            m.put("run_at", r.getRunAt()); m.put("reconciled", r.getReconciled()); m.put("matched", r.getMatched());
            m.put("breaks", r.getMissing() + r.getHeld() + r.getAmountDiffers() + r.getPending());
        }, () -> m.put("reconciled", null));
        return m;
    }

    private static Map<String, Object> brk(Line l, String kind, String why) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("receipt", l.receipt()); m.put("amount", l.amount()); m.put("kind", kind); m.put("why", why);
        return m;
    }

    /** Reads an M-Pesa statement export. Finds the header row itself, keeps only money paid in, and ignores everything else. */
    static List<Line> parse(String csv) {
        List<Line> out = new ArrayList<>();
        if (csv == null) return out;
        int receiptCol = -1, inCol = -1;
        for (String raw : csv.split("\\r?\\n")) {
            if (raw.isBlank()) continue;
            List<String> cells = cells(raw);
            if (receiptCol < 0) {
                for (int i = 0; i < cells.size(); i++) {
                    String h = cells.get(i).toLowerCase();
                    if (receiptCol < 0 && (h.contains("receipt") || h.equals("transaction id") || h.equals("trans id"))) receiptCol = i;
                    if (inCol < 0 && (h.contains("paid in") || h.equals("credit") || h.equals("amount"))) inCol = i;
                }
                if (receiptCol < 0 || inCol < 0) { receiptCol = -1; inCol = -1; }
                continue;
            }
            if (cells.size() <= Math.max(receiptCol, inCol)) continue;
            String receipt = cells.get(receiptCol).trim().toUpperCase();
            if (!receipt.matches("[A-Z0-9]{8,14}")) continue;
            BigDecimal amt;
            try { amt = new BigDecimal(cells.get(inCol).replace(",", "").trim()); } catch (Exception e) { continue; }
            if (amt.signum() > 0) out.add(new Line(receipt, amt));
        }
        return out;
    }

    private static List<String> cells(String line) {
        List<String> r = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean q = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') { if (q && i + 1 < line.length() && line.charAt(i + 1) == '"') { cur.append('"'); i++; } else q = !q; }
            else if (ch == ',' && !q) { r.add(cur.toString()); cur.setLength(0); }
            else cur.append(ch);
        }
        r.add(cur.toString());
        return r;
    }
}
