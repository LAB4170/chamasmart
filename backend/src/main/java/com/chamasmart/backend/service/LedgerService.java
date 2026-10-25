package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/** The journal behind the fund balances, and the check that the two agree. */
@Service
@RequiredArgsConstructor
@Slf4j
public class LedgerService {
    private final LedgerEntryRepository ledgerRepository;
    private final ChamaRepository chamaRepository;
    private final WelfareFundRepository welfareFundRepository;
    private final ChamaMemberRepository chamaMemberRepository;
    private final LoanRepository loanRepository;
    /** Optional so older unit tests that build this class by hand keep working. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private JournalService journal;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private LedgerCheckResultRepository checkResults;

    /** Called in the same transaction as the balance change it records. */
    public void post(Chama chama, String account, BigDecimal signedAmount, String entryType, String referenceType, Long referenceId, Long actorId, String memo) {
        if (signedAmount == null || signedAmount.signum() == 0) return;
        LedgerEntry saved = ledgerRepository.save(LedgerEntry.builder()
                .chama(chama).account(account).amount(signedAmount.setScale(2, RoundingMode.HALF_UP))
                .entryType(entryType).referenceType(referenceType).referenceId(referenceId).actorId(actorId)
                .memo(memo != null && memo.length() > 300 ? memo.substring(0, 300) : memo).build());
        if (journal != null && saved != null) journal.mirror(saved);
    }

    /** Guarantors' savings applied to a defaulted loan: savings owed fall, the loan owed falls, no cash moves. */
    public void postSavingsAppliedToLoan(Chama chama, BigDecimal amount, Long loanId, Long actorId) {
        if (journal == null || amount == null || amount.signum() <= 0) return;
        BigDecimal a = amount.setScale(2, RoundingMode.HALF_UP);
        journal.post(chama.getChamaId(), "GUARANTEE_CALL", "LOAN", loanId, actorId, "Guarantors' savings applied to defaulted loan", null,
                List.of(com.chamasmart.backend.ledger.JournalMapper.Line.debit(com.chamasmart.backend.ledger.Accounts.MEMBER_SAVINGS, a),
                        com.chamasmart.backend.ledger.JournalMapper.Line.credit(com.chamasmart.backend.ledger.Accounts.LOANS_RECEIVABLE, a)));
    }

    /** Unpaid fines taken from a departing member's savings: savings fall, fines income rises, no cash moves. */
    public void postFinesFromSavings(Chama chama, BigDecimal amount, Long exitId, Long actorId) {
        if (journal == null || amount == null || amount.signum() <= 0) return;
        BigDecimal a = amount.setScale(2, RoundingMode.HALF_UP);
        journal.post(chama.getChamaId(), "EXIT_FINES_TAKEN", "MEMBER_EXIT", exitId, actorId, "Unpaid fines taken from savings on exit", null,
                List.of(com.chamasmart.backend.ledger.JournalMapper.Line.debit(com.chamasmart.backend.ledger.Accounts.MEMBER_SAVINGS, a),
                        com.chamasmart.backend.ledger.JournalMapper.Line.credit(com.chamasmart.backend.ledger.Accounts.FINES_INCOME, a)));
    }

    /** The cover reserve paid part of a loan: the reserve and the loan owed both fall, no cash moves. */
    public void postCoverApplied(Chama chama, BigDecimal amount, Long loanId, Long actorId) {
        if (journal == null || amount == null || amount.signum() <= 0) return;
        BigDecimal a = amount.setScale(2, RoundingMode.HALF_UP);
        journal.post(chama.getChamaId(), "LOAN_COVER_PAID", "LOAN", loanId, actorId, "Cover reserve applied to loan", null,
                List.of(com.chamasmart.backend.ledger.JournalMapper.Line.debit(com.chamasmart.backend.ledger.Accounts.COVER_RESERVE, a),
                        com.chamasmart.backend.ledger.JournalMapper.Line.credit(com.chamasmart.backend.ledger.Accounts.LOANS_RECEIVABLE, a)));
    }

    /**
     * A loan cover premium is kept in the fund as a reserve: the member owes the full loan, the cash that left is smaller.
     * Posts the other half so the receivable and the reserve both read right.
     */
    public void postCoverPremium(Chama chama, BigDecimal premium, Long loanId, Long actorId) {
        if (journal == null || premium == null || premium.signum() <= 0) return;
        journal.post(chama.getChamaId(), "LOAN_COVER_PREMIUM", "LOAN", loanId, actorId, "Cover premium held as reserve",
                null, List.of(com.chamasmart.backend.ledger.JournalMapper.Line.debit(com.chamasmart.backend.ledger.Accounts.LOANS_RECEIVABLE, premium.setScale(2, RoundingMode.HALF_UP)),
                        com.chamasmart.backend.ledger.JournalMapper.Line.credit(com.chamasmart.backend.ledger.Accounts.COVER_RESERVE, premium.setScale(2, RoundingMode.HALF_UP))));
    }

    public record Line(String account, BigDecimal stored, BigDecimal ledger, BigDecimal difference, boolean ok) {}

    @Transactional(readOnly = true)
    public List<Line> reconcile(Long chamaId) {
        Chama chama = chamaRepository.findById(chamaId).orElseThrow(() -> new IllegalArgumentException("Chama not found"));
        List<Line> lines = new ArrayList<>();
        lines.add(line(LedgerEntry.CHAMA_FUND, chama.getCurrentFund(), ledgerRepository.balance(chamaId, LedgerEntry.CHAMA_FUND)));
        BigDecimal welfare = welfareFundRepository.findByChamaChamaId(chamaId).map(WelfareFund::getBalance).orElse(BigDecimal.ZERO);
        lines.add(line(LedgerEntry.WELFARE_FUND, welfare, ledgerRepository.balance(chamaId, LedgerEntry.WELFARE_FUND)));
        return lines;
    }

    private static Line line(String account, BigDecimal stored, BigDecimal ledger) {
        BigDecimal s = (stored == null ? BigDecimal.ZERO : stored).setScale(2, RoundingMode.HALF_UP);
        BigDecimal l = (ledger == null ? BigDecimal.ZERO : ledger).setScale(2, RoundingMode.HALF_UP);
        return new Line(account, s, l, s.subtract(l), s.compareTo(l) == 0);
    }

    @Transactional(readOnly = true)
    private String officialRole(Long chamaId, Long actorId) {
        ChamaMember m = chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, actorId).filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new AccessDeniedException("You are not an active member of this chama"));
        String role = m.getRole() == null ? "" : m.getRole().toUpperCase();
        if (!List.of("CHAIRPERSON", "TREASURER", "SECRETARY").contains(role)) throw new AccessDeniedException("Only chama officials can see the ledger");
        return role;
    }

    public String trialBalanceCsv(Long chamaId, Long actorId, java.time.LocalDate asOf) {
        officialRole(chamaId, actorId);
        return journal.trialBalanceCsv(chamaId, asOf == null ? java.time.LocalDate.now() : asOf);
    }

    /** Only the chairperson or treasurer closes the books. */
    public Map<String, Object> closePeriod(Long chamaId, Long actorId, java.time.LocalDate end) {
        String role = officialRole(chamaId, actorId);
        if (!List.of("CHAIRPERSON", "TREASURER").contains(role)) throw new AccessDeniedException("Only the chairperson or treasurer can close the books");
        return journal.closePeriod(chamaId, end, actorId);
    }

    public Map<String, Object> report(Long chamaId, Long actorId) {
        ChamaMember m = chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, actorId).filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new AccessDeniedException("You are not an active member of this chama"));
        String role = m.getRole() == null ? "" : m.getRole().toUpperCase();
        if (!List.of("CHAIRPERSON", "TREASURER", "SECRETARY").contains(role)) throw new AccessDeniedException("Only chama officials can see the ledger");
        List<Line> lines = reconcile(chamaId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("balanced", lines.stream().allMatch(Line::ok));
        out.put("accounts", lines.stream().map(l -> {
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("account", l.account()); a.put("stored_balance", l.stored()); a.put("ledger_balance", l.ledger());
            a.put("difference", l.difference()); a.put("ok", l.ok());
            return a;
        }).toList());
        if (journal != null) out.put("journal", journalChecks(chamaId));
        out.put("recent_entries", ledgerRepository.findTop100ByChamaChamaIdOrderByEntryIdDesc(chamaId).stream().map(e -> {
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("entry_id", e.getEntryId()); a.put("account", e.getAccount()); a.put("amount", e.getAmount());
            a.put("type", e.getEntryType()); a.put("reference_type", e.getReferenceType()); a.put("reference_id", e.getReferenceId());
            a.put("actor_id", e.getActorId()); a.put("memo", e.getMemo()); a.put("created_at", e.getCreatedAt());
            return a;
        }).toList());
        return out;
    }

    /** The double-entry side: does it balance, does it agree with the stored balances, and is the chain intact. */
    @Transactional(readOnly = true)
    public Map<String, Object> journalChecks(Long chamaId) {
        Chama chama = chamaRepository.findById(chamaId).orElseThrow(() -> new IllegalArgumentException("Chama not found"));
        Map<String, Object> tb = journal.trialBalance(chamaId);
        List<Map<String, Object>> checks = new ArrayList<>();
        checks.add(check("Debits equal credits", tb.get("total_debit"), tb.get("total_credit")));
        checks.add(check("Cash equals the fund balance", journal.balance(chamaId, com.chamasmart.backend.ledger.Accounts.CASH), chama.getCurrentFund()));
        BigDecimal welfare = welfareFundRepository.findByChamaChamaId(chamaId).map(WelfareFund::getBalance).orElse(BigDecimal.ZERO);
        checks.add(check("Welfare cash equals the welfare balance", journal.balance(chamaId, com.chamasmart.backend.ledger.Accounts.WELFARE_CASH), welfare));
        BigDecimal savings = chamaMemberRepository.findByChamaChamaIdAndIsActiveTrue(chamaId).stream()
                .map(m -> m.getTotalContributions() == null ? BigDecimal.ZERO : m.getTotalContributions()).reduce(BigDecimal.ZERO, BigDecimal::add);
        checks.add(check("Savings owed to members equal their recorded savings", journal.balance(chamaId, com.chamasmart.backend.ledger.Accounts.MEMBER_SAVINGS).negate(), savings));
        BigDecimal reserve = loanRepository.coverReserve(chamaId);
        checks.add(check("Cover reserve in the journal equals the reserve held", journal.balance(chamaId, com.chamasmart.backend.ledger.Accounts.COVER_RESERVE).negate(), reserve == null ? BigDecimal.ZERO : reserve));
        checks.add(check("Suspense is clear", journal.balance(chamaId, com.chamasmart.backend.ledger.Accounts.SUSPENSE), BigDecimal.ZERO));
        var broken = journal.firstBrokenLink(chamaId);
        Map<String, Object> chain = new LinkedHashMap<>();
        chain.put("name", "Journal chain is intact");
        chain.put("ok", broken.isEmpty());
        chain.put("first_broken_entry", broken.orElse(null));
        checks.add(chain);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("trial_balance", tb);
        out.put("checks", checks);
        out.put("all_ok", checks.stream().allMatch(c -> Boolean.TRUE.equals(c.get("ok"))));
        return out;
    }

    private static Map<String, Object> check(String name, Object actual, Object expected) {
        BigDecimal a = ((BigDecimal) actual).setScale(2, RoundingMode.HALF_UP);
        BigDecimal e = ((BigDecimal) expected).setScale(2, RoundingMode.HALF_UP);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("actual", a);
        m.put("expected", e);
        m.put("difference", a.subtract(e));
        m.put("ok", a.compareTo(e) == 0);
        return m;
    }

    private void recordCheck(Long chamaId, boolean ok, Map<String, Object> result) {
        if (checkResults == null) return;
        try {
            int failed = 0;
            Object cs = result.get("checks");
            if (cs instanceof List<?> list) for (Object o : list) if (o instanceof Map<?, ?> m && Boolean.FALSE.equals(m.get("ok"))) failed++;
            checkResults.save(LedgerCheckResult.builder().chamaId(chamaId).allOk(ok).failed(failed).checkedAt(java.time.ZonedDateTime.now()).build());
        } catch (Exception e) { log.warn("Could not store the books check for chama {}: {}", chamaId, e.getMessage()); }
    }

    /** Every night: compare each chama's stored balances with its journal and shout if they differ. */
    @Scheduled(cron = "0 30 2 * * *")
    @Transactional(readOnly = true)
    public void nightlyReconciliation() {
        int bad = 0;
        for (Chama c : chamaRepository.findAll()) {
            for (Line l : reconcile(c.getChamaId())) {
                if (!l.ok()) {
                    bad++;
                    log.error("LEDGER MISMATCH chama={} account={} stored={} ledger={} difference={}", c.getChamaId(), l.account(), l.stored(), l.ledger(), l.difference());
                }
            }
        }
        if (journal != null) {
            for (Chama c : chamaRepository.findAll()) {
                Map<String, Object> result = journalChecks(c.getChamaId());
                boolean ok = Boolean.TRUE.equals(result.get("all_ok"));
                if (!ok) {
                    bad++;
                    log.error("JOURNAL CHECK FAILED chama={} checks={}", c.getChamaId(), result.get("checks"));
                }
                recordCheck(c.getChamaId(), ok, result);
            }
        }
        if (bad == 0) log.info("Ledger reconciliation: every fund agrees with its journal");
    }
}
