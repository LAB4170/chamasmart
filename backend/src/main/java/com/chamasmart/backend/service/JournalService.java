package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.JournalEntry;
import com.chamasmart.backend.domain.JournalLine;
import com.chamasmart.backend.domain.LedgerEntry;
import com.chamasmart.backend.ledger.Accounts;
import com.chamasmart.backend.ledger.JournalMapper;
import com.chamasmart.backend.repository.JournalEntryRepository;
import com.chamasmart.backend.repository.JournalLineRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.*;

/**
 * The double-entry journal. Every posting is a set of debits and credits that must balance, is chained to the one
 * before it by a hash, and cannot be edited afterwards (the database enforces both rules).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JournalService {
    static final String GENESIS = "0".repeat(64);

    private final JournalEntryRepository entries;
    private final JournalLineRepository lines;

    @PersistenceContext
    private EntityManager em;

    /** Posts a balanced entry. Throws if debits and credits differ or any amount is not positive. */
    @Transactional
    public JournalEntry post(Long chamaId, String entryType, String referenceType, Long referenceId, Long actorId, String memo, Long legacyEntryId, List<JournalMapper.Line> posting) {
        return post(chamaId, entryType, referenceType, referenceId, actorId, memo, legacyEntryId, posting, ZonedDateTime.now());
    }

    @Transactional
    public JournalEntry post(Long chamaId, String entryType, String referenceType, Long referenceId, Long actorId, String memo, Long legacyEntryId, List<JournalMapper.Line> posting, ZonedDateTime at) {
        return doPost(chamaId, entryType, referenceType, referenceId, actorId, memo, legacyEntryId, null, posting, at);
    }

    private JournalEntry doPost(Long chamaId, String entryType, String referenceType, Long referenceId, Long actorId, String memo, Long legacyEntryId, Long reversesId, List<JournalMapper.Line> posting, ZonedDateTime at) {
        if (posting == null || posting.size() < 2) throw new IllegalArgumentException("A journal entry needs at least two lines");
        BigDecimal debits = BigDecimal.ZERO, credits = BigDecimal.ZERO;
        for (JournalMapper.Line l : posting) {
            if (l.debit().signum() < 0 || l.credit().signum() < 0 || (l.debit().signum() == 0 && l.credit().signum() == 0) || (l.debit().signum() > 0 && l.credit().signum() > 0))
                throw new IllegalArgumentException("Each line must carry exactly one positive amount");
            debits = debits.add(l.debit());
            credits = credits.add(l.credit());
        }
        if (debits.compareTo(credits) != 0) throw new IllegalArgumentException("Debits " + debits + " and credits " + credits + " do not match");

        lockChain(chamaId);
        LocalDate closed = closedThrough(chamaId);
        if (closed != null && !at.toLocalDate().isAfter(closed)) throw new IllegalStateException("The books are closed up to " + closed + "; nothing can be posted on or before that date");
        String prev = entries.findFirstByChamaIdOrderByEntryIdDesc(chamaId).map(JournalEntry::getEntryHash).orElse(GENESIS);
        String trimmedMemo = memo != null && memo.length() > 300 ? memo.substring(0, 300) : memo;
        String hash = hash(prev, chamaId, entryType, referenceType, referenceId, actorId, at, posting);
        JournalEntry saved = entries.save(JournalEntry.builder().chamaId(chamaId).postedAt(at).entryType(entryType).referenceType(referenceType).referenceId(referenceId)
                .actorId(actorId).memo(trimmedMemo).legacyEntryId(legacyEntryId).reversesEntryId(reversesId).prevHash(prev).entryHash(hash).build());
        for (JournalMapper.Line l : posting) {
            lines.save(JournalLine.builder().entryId(saved.getEntryId()).chamaId(chamaId).account(l.account())
                    .debit(l.debit().setScale(2, RoundingMode.HALF_UP)).credit(l.credit().setScale(2, RoundingMode.HALF_UP)).build());
        }
        return saved;
    }

    /** Last closed day for a chama, or null when no period has been closed. */
    @Transactional(readOnly = true)
    public LocalDate closedThrough(Long chamaId) {
        if (em == null) return null;
        Object d = em.createNativeQuery("SELECT MAX(period_end) FROM accounting_periods WHERE chama_id = :c").setParameter("c", chamaId).getSingleResult();
        return d == null ? null : ((java.sql.Date) d).toLocalDate();
    }

    /**
     * Corrects an entry by posting its mirror image, linked back to it. The original stays untouched, and an entry can be reversed once.
     * The caller is responsible for undoing the business record the entry belonged to.
     */
    @Transactional
    public JournalEntry reverse(Long chamaId, Long entryId, Long actorId, String reason) {
        if (reason == null || reason.isBlank()) throw new IllegalArgumentException("Give a reason for the reversal");
        JournalEntry original = entries.findById(entryId).filter(e -> e.getChamaId().equals(chamaId)).orElseThrow(() -> new IllegalArgumentException("Journal entry not found"));
        if (original.getReversesEntryId() != null) throw new IllegalStateException("A reversal cannot itself be reversed; post a new entry instead");
        if (entries.existsByReversesEntryId(entryId)) throw new IllegalStateException("This entry has already been reversed");
        List<JournalMapper.Line> mirror = lines.findByEntryId(entryId).stream()
                .map(l -> new JournalMapper.Line(l.getAccount(), l.getCredit(), l.getDebit())).toList();
        String memo = "Reversal of #" + entryId + ": " + reason.trim();
        return doPost(chamaId, "REVERSAL_ENTRY", original.getReferenceType(), original.getReferenceId(), actorId, memo, null, entryId, mirror, ZonedDateTime.now());
    }

    /** Debits and credits per account up to and including a day. */
    @Transactional(readOnly = true)
    public Map<String, Object> trialBalanceAsOf(Long chamaId, LocalDate asOf) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("SELECT l.account, COALESCE(SUM(l.debit),0), COALESCE(SUM(l.credit),0) FROM journal_lines l JOIN journal_entries e ON e.entry_id = l.entry_id "
                + "WHERE l.chama_id = :c AND e.posted_at < :end GROUP BY l.account ORDER BY l.account")
                .setParameter("c", chamaId).setParameter("end", asOf.plusDays(1).atStartOfDay(java.time.ZoneId.of("Africa/Nairobi")).toOffsetDateTime()).getResultList();
        List<Map<String, Object>> accounts = new ArrayList<>();
        BigDecimal td = BigDecimal.ZERO, tc = BigDecimal.ZERO;
        for (Object[] r : rows) {
            BigDecimal d = (BigDecimal) r[1], c = (BigDecimal) r[2];
            td = td.add(d); tc = tc.add(c);
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("account", r[0]); a.put("debit", d); a.put("credit", c); a.put("balance", d.subtract(c));
            accounts.add(a);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("as_of", asOf.toString()); out.put("accounts", accounts);
        out.put("total_debit", td); out.put("total_credit", tc); out.put("balanced", td.compareTo(tc) == 0);
        return out;
    }

    /** Closes the books up to a past day. Refused if the trial balance does not balance or the chain is broken. */
    @Transactional
    public Map<String, Object> closePeriod(Long chamaId, LocalDate end, Long actorId) {
        if (!end.isBefore(LocalDate.now(java.time.ZoneId.of("Africa/Nairobi")))) throw new IllegalArgumentException("Only a day that has already ended can be closed");
        LocalDate already = closedThrough(chamaId);
        if (already != null && !end.isAfter(already)) throw new IllegalStateException("The books are already closed up to " + already);
        lockChain(chamaId);
        Map<String, Object> tb = trialBalanceAsOf(chamaId, end);
        if (!Boolean.TRUE.equals(tb.get("balanced"))) throw new IllegalStateException("The trial balance does not balance, so this period cannot be closed");
        if (firstBrokenLink(chamaId).isPresent()) throw new IllegalStateException("The journal chain is broken, so this period cannot be closed");
        JournalEntry last = entries.findFirstByChamaIdOrderByEntryIdDesc(chamaId).orElse(null);
        em.createNativeQuery("INSERT INTO accounting_periods (chama_id, period_end, closed_by, trial_debit, trial_credit, last_entry_id, last_entry_hash) VALUES (:c,:e,:u,:d,:cr,:i,:h)")
                .setParameter("c", chamaId).setParameter("e", java.sql.Date.valueOf(end)).setParameter("u", actorId).setParameter("d", tb.get("total_debit"))
                .setParameter("cr", tb.get("total_credit")).setParameter("i", last == null ? null : last.getEntryId()).setParameter("h", last == null ? null : last.getEntryHash()).executeUpdate();
        tb.put("closed_through", end.toString());
        return tb;
    }

    /** The trial balance as CSV, ready for an accountant. */
    public String trialBalanceCsv(Long chamaId, LocalDate asOf) {
        Map<String, Object> tb = trialBalanceAsOf(chamaId, asOf);
        StringBuilder sb = new StringBuilder("Account,Debit,Credit,Balance (Dr+/Cr-)\r\n");
        @SuppressWarnings("unchecked") List<Map<String, Object>> accts = (List<Map<String, Object>>) tb.get("accounts");
        for (Map<String, Object> a : accts) sb.append(a.get("account")).append(',').append(a.get("debit")).append(',').append(a.get("credit")).append(',').append(a.get("balance")).append("\r\n");
        sb.append("TOTAL,").append(tb.get("total_debit")).append(',').append(tb.get("total_credit")).append(',').append("\r\n");
        sb.append("As of ").append(asOf).append(Boolean.TRUE.equals(tb.get("balanced")) ? ",BALANCED" : ",OUT OF BALANCE").append("\r\n");
        return sb.toString();
    }

    /** Mirrors one single-entry ledger row as a balanced journal entry. Safe to call twice for the same row. */
    @Transactional
    public void mirror(LedgerEntry legacy) {
        if (legacy.getEntryId() != null && entries.existsByLegacyEntryId(legacy.getEntryId())) return;
        List<JournalMapper.Line> posting = JournalMapper.map(legacy.getAccount(), legacy.getAmount(), legacy.getEntryType());
        if (posting.isEmpty()) return;
        post(legacy.getChama().getChamaId(), legacy.getEntryType(), legacy.getReferenceType(), legacy.getReferenceId(), legacy.getActorId(), legacy.getMemo(), legacy.getEntryId(), posting, legacy.getCreatedAt() != null ? legacy.getCreatedAt() : ZonedDateTime.now());
    }

    /** Debits minus credits per account, and whether the whole book balances. */
    @Transactional(readOnly = true)
    public Map<String, Object> trialBalance(Long chamaId) {
        List<Map<String, Object>> accounts = new ArrayList<>();
        BigDecimal totalDebit = BigDecimal.ZERO, totalCredit = BigDecimal.ZERO;
        for (Object[] row : lines.trialBalance(chamaId)) {
            BigDecimal d = (BigDecimal) row[1], c = (BigDecimal) row[2];
            totalDebit = totalDebit.add(d);
            totalCredit = totalCredit.add(c);
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("account", row[0]);
            a.put("debit", d);
            a.put("credit", c);
            a.put("balance", d.subtract(c));
            accounts.add(a);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("accounts", accounts);
        out.put("total_debit", totalDebit);
        out.put("total_credit", totalCredit);
        out.put("balanced", totalDebit.compareTo(totalCredit) == 0);
        return out;
    }

    /** Debit balance of one account (negative for credit-balance accounts such as savings). */
    @Transactional(readOnly = true)
    public BigDecimal balance(Long chamaId, String account) {
        BigDecimal b = lines.debitBalance(chamaId, account);
        return b == null ? BigDecimal.ZERO : b;
    }

    /** Re-computes every hash of a chama's chain. Returns the id of the first entry that does not match, or empty when intact. */
    @Transactional(readOnly = true)
    public Optional<Long> firstBrokenLink(Long chamaId) {
        String prev = GENESIS;
        for (JournalEntry e : entries.findByChamaIdOrderByEntryIdAsc(chamaId)) {
            List<JournalMapper.Line> posting = lines.findByEntryId(e.getEntryId()).stream()
                    .map(l -> new JournalMapper.Line(l.getAccount(), l.getDebit(), l.getCredit())).toList();
            String expected = hash(prev, e.getChamaId(), e.getEntryType(), e.getReferenceType(), e.getReferenceId(), e.getActorId(), e.getPostedAt(), posting);
            if (!prev.equals(e.getPrevHash()) || !expected.equals(e.getEntryHash())) return Optional.of(e.getEntryId());
            prev = e.getEntryHash();
        }
        return Optional.empty();
    }

    /** Turns every old single-entry row that has no journal entry yet into one. Idempotent. */
    @Transactional
    public int backfill(List<LedgerEntry> legacyRows) {
        int made = 0;
        for (LedgerEntry row : legacyRows) {
            if (row.getEntryId() != null && entries.existsByLegacyEntryId(row.getEntryId())) continue;
            mirror(row);
            made++;
        }
        return made;
    }

    private void lockChain(Long chamaId) {
        if (em == null) return; // unit tests without a database
        em.createNativeQuery("SELECT pg_advisory_xact_lock(:k)").setParameter("k", 7_000_000_000L + chamaId).getSingleResult();
    }

    static String hash(String prev, Long chamaId, String type, String refType, Long refId, Long actor, ZonedDateTime at, List<JournalMapper.Line> posting) {
        StringBuilder sb = new StringBuilder(prev).append('|').append(chamaId).append('|').append(type).append('|').append(refType).append('|').append(refId)
                .append('|').append(actor).append('|').append(at.toInstant().toEpochMilli());
        List<String> parts = new ArrayList<>();
        for (JournalMapper.Line l : posting) parts.add(l.account() + ":" + l.debit().setScale(2, RoundingMode.HALF_UP) + ":" + l.credit().setScale(2, RoundingMode.HALF_UP));
        Collections.sort(parts);
        sb.append('|').append(String.join(";", parts));
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(sb.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Names used in reports, in the order an accountant expects. */
    public static final List<String> ACCOUNT_ORDER = List.of(Accounts.CASH, Accounts.WELFARE_CASH, Accounts.LOANS_RECEIVABLE, Accounts.SUSPENSE,
            Accounts.MEMBER_SAVINGS, Accounts.WELFARE_RESERVE, Accounts.COVER_RESERVE, Accounts.ASCA_EQUITY, Accounts.INTEREST_INCOME, Accounts.FEE_INCOME, Accounts.FINES_INCOME, Accounts.EXPENSES);
}
