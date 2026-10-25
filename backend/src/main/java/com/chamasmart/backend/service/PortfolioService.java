package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.ChamaMember;
import com.chamasmart.backend.repository.ChamaMemberRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.*;
import java.util.stream.Collectors;

/**
 * One view across every chama where the person is an official. Scope is membership, never ownership of the platform: a person sees
 * exactly the chamas they already run, and nothing else. Everything is read in a few grouped queries, not one query per chama.
 */
@Service
@RequiredArgsConstructor
public class PortfolioService {
    private final ChamaMemberRepository members;

    @PersistenceContext
    private EntityManager em;

    public record Row(Long chamaId, String name, String type, String role, String currency, BigDecimal fund, int memberCount, int heldCount, BigDecimal heldAmount,
                      int pendingCount, Boolean reconciled, Timestamp reconciledAt, String plan, String planStatus, Boolean booksOk, Timestamp booksAt) {
        /** Something an official should look at. */
        public boolean needsAttention() {
            return heldCount > 0 || Boolean.FALSE.equals(reconciled) || Boolean.FALSE.equals(booksOk) || "PAST_DUE".equals(planStatus) || "SUSPENDED".equals(planStatus);
        }
        public List<String> reasons() {
            List<String> r = new ArrayList<>();
            if (heldCount > 0) r.add(heldCount + " held payment" + (heldCount == 1 ? "" : "s"));
            if (Boolean.FALSE.equals(reconciled)) r.add("Statement has unmatched payments");
            if (Boolean.FALSE.equals(booksOk)) r.add("Books check failed");
            if ("PAST_DUE".equals(planStatus)) r.add("Plan payment due");
            if ("SUSPENDED".equals(planStatus)) r.add("Plan suspended");
            return r;
        }
    }

    @Transactional(readOnly = true)
    public List<Row> rows(Long userId) {
        Map<Long, String> roles = new LinkedHashMap<>();
        for (ChamaMember m : members.findActiveMembershipsByUserId(userId)) if (MembershipService.isOfficial(m)) roles.put(m.getChama().getChamaId(), m.getRole());
        if (roles.isEmpty()) return List.of();
        List<Long> ids = new ArrayList<>(roles.keySet());

        Map<Long, Object[]> held = byChama(q("SELECT chama_id, COUNT(*), COALESCE(SUM(amount),0) FROM payment_events WHERE status='UNMATCHED' AND chama_id IN (:ids) GROUP BY chama_id", ids));
        Map<Long, Object[]> pending = byChama(q("SELECT chama_id, COUNT(*) FROM contributions WHERE UPPER(status)='PENDING' AND is_deleted=false AND chama_id IN (:ids) GROUP BY chama_id", ids));
        Map<Long, Object[]> recon = byChama(q("SELECT DISTINCT ON (chama_id) chama_id, reconciled, run_at FROM reconciliation_runs WHERE chama_id IN (:ids) ORDER BY chama_id, run_at DESC", ids));
        Map<Long, Object[]> subs = byChama(q("SELECT DISTINCT ON (chama_id) chama_id, plan_code, status FROM chama_subscriptions WHERE chama_id IN (:ids) ORDER BY chama_id, subscription_id DESC", ids));
        Map<Long, Object[]> books = byChama(q("SELECT chama_id, all_ok, checked_at FROM ledger_check_results WHERE chama_id IN (:ids)", ids));

        List<Row> out = new ArrayList<>();
        for (Object[] c : q("SELECT chama_id, chama_name, chama_type, currency, current_fund, total_members FROM chamas WHERE chama_id IN (:ids)", ids)) {
            Long id = ((Number) c[0]).longValue();
            Object[] h = held.get(id), p = pending.get(id), r = recon.get(id), s = subs.get(id), b = books.get(id);
            out.add(new Row(id, (String) c[1], (String) c[2], roles.get(id), (String) c[3], (BigDecimal) c[4], c[5] == null ? 0 : ((Number) c[5]).intValue(),
                    h == null ? 0 : ((Number) h[1]).intValue(), h == null ? BigDecimal.ZERO : (BigDecimal) h[2], p == null ? 0 : ((Number) p[1]).intValue(),
                    r == null ? null : (Boolean) r[1], r == null ? null : (Timestamp) r[2], s == null ? "STARTER" : (String) s[1], s == null ? "ACTIVE" : (String) s[2],
                    b == null ? null : (Boolean) b[1], b == null ? null : (Timestamp) b[2]));
        }
        return out;
    }

    /** A page of chamas, the ones needing attention first, then by name. Totals always cover every chama, not just the page. */
    @Transactional(readOnly = true)
    public Map<String, Object> page(Long userId, String search, boolean onlyAttention, int page, int size) {
        List<Row> all = rows(userId);
        String q = search == null ? "" : search.trim().toLowerCase();
        List<Row> filtered = all.stream().filter(r -> q.isEmpty() || r.name().toLowerCase().contains(q) || r.type().toLowerCase().contains(q))
                .filter(r -> !onlyAttention || r.needsAttention())
                .sorted(Comparator.comparing((Row r) -> !r.needsAttention()).thenComparing(r -> r.name().toLowerCase())).toList();
        int s = Math.max(1, Math.min(size, 100)), pg = Math.max(0, page);
        int from = Math.min(pg * s, filtered.size());
        List<Map<String, Object>> items = filtered.subList(from, Math.min(from + s, filtered.size())).stream().map(PortfolioService::view).toList();

        Map<String, BigDecimal> fundByCurrency = new TreeMap<>();
        for (Row r : all) fundByCurrency.merge(r.currency() == null ? "KES" : r.currency(), r.fund() == null ? BigDecimal.ZERO : r.fund(), BigDecimal::add);
        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("chamas", all.size());
        totals.put("members", all.stream().mapToInt(Row::memberCount).sum());
        totals.put("fund_by_currency", fundByCurrency);
        totals.put("held_payments", all.stream().mapToInt(Row::heldCount).sum());
        totals.put("held_amount", all.stream().map(Row::heldAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
        totals.put("pending_verification", all.stream().mapToInt(Row::pendingCount).sum());
        totals.put("needing_attention", all.stream().filter(Row::needsAttention).count());
        totals.put("never_reconciled", all.stream().filter(r -> r.reconciled() == null).count());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totals", totals);
        out.put("items", items);
        out.put("page", pg); out.put("size", s); out.put("total_items", filtered.size());
        out.put("total_pages", (int) Math.ceil(filtered.size() / (double) s));
        return out;
    }

    /** The whole portfolio as CSV for an accountant or a board pack. */
    @Transactional(readOnly = true)
    public String csv(Long userId) {
        StringBuilder sb = new StringBuilder("Chama,Type,Your role,Currency,Fund,Members,Held payments,Held amount,Pending verification,Statement checked,Statement result,Books check,Plan,Plan status,Needs attention\r\n");
        for (Row r : rows(userId).stream().sorted(Comparator.comparing(x -> x.name().toLowerCase())).toList()) {
            sb.append(esc(r.name())).append(',').append(esc(r.type())).append(',').append(esc(r.role())).append(',').append(esc(r.currency())).append(',')
              .append(r.fund()).append(',').append(r.memberCount()).append(',').append(r.heldCount()).append(',').append(r.heldAmount()).append(',').append(r.pendingCount()).append(',')
              .append(r.reconciledAt() == null ? "never" : r.reconciledAt().toLocalDateTime().toLocalDate()).append(',').append(r.reconciled() == null ? "" : r.reconciled() ? "All matched" : "Needs attention").append(',')
              .append(r.booksOk() == null ? "not yet checked" : r.booksOk() ? "OK" : "FAILED").append(',').append(esc(r.plan())).append(',').append(esc(r.planStatus())).append(',')
              .append(String.join("; ", r.reasons())).append("\r\n");
        }
        return sb.toString();
    }

    private static Map<String, Object> view(Row r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("chama_id", r.chamaId()); m.put("name", r.name()); m.put("type", r.type()); m.put("role", r.role()); m.put("currency", r.currency());
        m.put("fund", r.fund()); m.put("members", r.memberCount()); m.put("held_count", r.heldCount()); m.put("held_amount", r.heldAmount());
        m.put("pending_verification", r.pendingCount()); m.put("reconciled", r.reconciled()); m.put("reconciled_at", r.reconciledAt() == null ? null : r.reconciledAt().toInstant().toString());
        m.put("plan", r.plan()); m.put("plan_status", r.planStatus()); m.put("books_ok", r.booksOk()); m.put("books_checked_at", r.booksAt() == null ? null : r.booksAt().toInstant().toString());
        m.put("needs_attention", r.needsAttention()); m.put("reasons", r.reasons());
        return m;
    }

    @SuppressWarnings("unchecked")
    private List<Object[]> q(String sql, List<Long> ids) { return em.createNativeQuery(sql).setParameter("ids", ids).getResultList(); }

    private static Map<Long, Object[]> byChama(List<Object[]> rows) {
        return rows.stream().collect(Collectors.toMap(r -> ((Number) r[0]).longValue(), r -> r, (a, b) -> a));
    }

    /** Guards a spreadsheet against formulas hidden in text, and quotes anything with a comma. */
    private static String esc(String s) {
        if (s == null) return "";
        String t = s.replace("\"", "\"\"");
        if (!t.isEmpty() && "=+-@\t\r".indexOf(t.charAt(0)) >= 0) t = "'" + t;
        return t.contains(",") || t.contains("\"") || t.contains("\n") || t.startsWith("'") ? "\"" + t + "\"" : t;
    }
}
