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
        String prev = entries.findFirstByChamaIdOrderByEntryIdDesc(chamaId).map(JournalEntry::getEntryHash).orElse(GENESIS);
        String trimmedMemo = memo != null && memo.length() > 300 ? memo.substring(0, 300) : memo;
        String hash = hash(prev, chamaId, entryType, referenceType, referenceId, actorId, at, posting);
        JournalEntry saved = entries.save(JournalEntry.builder().chamaId(chamaId).postedAt(at).entryType(entryType).referenceType(referenceType).referenceId(referenceId)
                .actorId(actorId).memo(trimmedMemo).legacyEntryId(legacyEntryId).prevHash(prev).entryHash(hash).build());
        for (JournalMapper.Line l : posting) {
            lines.save(JournalLine.builder().entryId(saved.getEntryId()).chamaId(chamaId).account(l.account())
                    .debit(l.debit().setScale(2, RoundingMode.HALF_UP)).credit(l.credit().setScale(2, RoundingMode.HALF_UP)).build());
        }
        return saved;
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
            Accounts.MEMBER_SAVINGS, Accounts.WELFARE_RESERVE, Accounts.COVER_RESERVE, Accounts.ASCA_EQUITY, Accounts.INTEREST_INCOME, Accounts.FEE_INCOME);
}
