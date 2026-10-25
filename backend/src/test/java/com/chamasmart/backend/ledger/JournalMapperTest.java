package com.chamasmart.backend.ledger;

import com.chamasmart.backend.domain.LedgerEntry;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

class JournalMapperTest {
    private static BigDecimal d(String v) { return new BigDecimal(v); }

    private static BigDecimal debits(List<JournalMapper.Line> l) { return l.stream().map(JournalMapper.Line::debit).reduce(BigDecimal.ZERO, BigDecimal::add); }
    private static BigDecimal credits(List<JournalMapper.Line> l) { return l.stream().map(JournalMapper.Line::credit).reduce(BigDecimal.ZERO, BigDecimal::add); }

    @Test
    void contributionDebitsCashAndCreditsMemberSavings() {
        var lines = JournalMapper.map(LedgerEntry.CHAMA_FUND, d("1500.00"), "CONTRIBUTION");
        assertEquals(2, lines.size());
        assertEquals(Accounts.CASH, lines.get(0).account());
        assertEquals(d("1500.00"), lines.get(0).debit());
        assertEquals(Accounts.MEMBER_SAVINGS, lines.get(1).account());
        assertEquals(d("1500.00"), lines.get(1).credit());
    }

    @Test
    void reversalIsTheMirrorImage() {
        var lines = JournalMapper.map(LedgerEntry.CHAMA_FUND, d("-1500.00"), "REVERSAL");
        assertEquals(Accounts.MEMBER_SAVINGS, lines.get(0).account());
        assertEquals(d("1500.00"), lines.get(0).debit());
        assertEquals(Accounts.CASH, lines.get(1).account());
        assertEquals(d("1500.00"), lines.get(1).credit());
    }

    @Test
    void loanLifecycleLeavesReceivableAtPrincipalPlusInterest() {
        // Disburse 10,000 (premium handled separately), earn 1,000 interest, receive 11,000 back.
        BigDecimal receivable = BigDecimal.ZERO;
        for (var step : List.of(
                new Object[]{LedgerEntry.CHAMA_FUND, "-10000.00", "LOAN_DISBURSEMENT"},
                new Object[]{"INTEREST_INCOME", "1000.00", "LOAN_INTEREST"},
                new Object[]{LedgerEntry.CHAMA_FUND, "11000.00", "LOAN_REPAYMENT"})) {
            for (var l : JournalMapper.map((String) step[0], d((String) step[1]), (String) step[2])) {
                if (l.account().equals(Accounts.LOANS_RECEIVABLE)) receivable = receivable.add(l.debit()).subtract(l.credit());
            }
        }
        assertEquals(0, receivable.compareTo(BigDecimal.ZERO));
    }

    @Test
    void welfareUsesItsOwnCash() {
        var in = JournalMapper.map(LedgerEntry.WELFARE_FUND, d("500"), "CONTRIBUTION");
        assertEquals(Accounts.WELFARE_CASH, in.get(0).account());
        assertEquals(Accounts.WELFARE_RESERVE, in.get(1).account());
        var out = JournalMapper.map(LedgerEntry.WELFARE_FUND, d("-200"), "WELFARE_PAYOUT");
        assertEquals(Accounts.WELFARE_RESERVE, out.get(0).account());
        assertEquals(Accounts.WELFARE_CASH, out.get(1).account());
    }

    @Test
    void unknownKindsLandInSuspenseSoTheyCannotHide() {
        var lines = JournalMapper.map(LedgerEntry.CHAMA_FUND, d("10"), "SOMETHING_NEW");
        assertEquals(Accounts.SUSPENSE, lines.get(1).account());
    }

    @Test
    void zeroAmountMakesNoLines() {
        assertTrue(JournalMapper.map(LedgerEntry.CHAMA_FUND, BigDecimal.ZERO, "CONTRIBUTION").isEmpty());
        assertTrue(JournalMapper.map(LedgerEntry.CHAMA_FUND, null, "CONTRIBUTION").isEmpty());
    }

    @Test
    void everyPostingBalancesForRandomInputs() {
        String[] types = {"CONTRIBUTION", "MPESA_CONTRIBUTION", "REVERSAL", "LOAN_DISBURSEMENT", "LOAN_REPAYMENT", "MEMBER_EXIT_REFUND",
                "ROSCA_POT_PAYOUT", "ASCA_SHARE_PURCHASE", "ASCA_SHARE_OUT", "WELFARE_PAYOUT", "UNKNOWN"};
        String[] accounts = {LedgerEntry.CHAMA_FUND, LedgerEntry.WELFARE_FUND, "INTEREST_INCOME", "FEE_INCOME"};
        Random rnd = new Random(42);
        for (int i = 0; i < 2000; i++) {
            BigDecimal amount = BigDecimal.valueOf(rnd.nextInt(2_000_000) - 1_000_000, 2);
            var lines = JournalMapper.map(accounts[rnd.nextInt(accounts.length)], amount, types[rnd.nextInt(types.length)]);
            assertEquals(0, debits(lines).compareTo(credits(lines)), "unbalanced for " + amount);
            for (var l : lines) assertTrue(l.debit().signum() >= 0 && l.credit().signum() >= 0);
        }
    }

    @Test
    void cashMovesByExactlyTheLedgerAmount() {
        var in = JournalMapper.map(LedgerEntry.CHAMA_FUND, d("123.45"), "LOAN_REPAYMENT");
        BigDecimal cash = BigDecimal.ZERO;
        for (var l : in) if (l.account().equals(Accounts.CASH)) cash = cash.add(l.debit()).subtract(l.credit());
        assertEquals(d("123.45"), cash);
        var out = JournalMapper.map(LedgerEntry.CHAMA_FUND, d("-123.45"), "LOAN_DISBURSEMENT");
        cash = BigDecimal.ZERO;
        for (var l : out) if (l.account().equals(Accounts.CASH)) cash = cash.add(l.debit()).subtract(l.credit());
        assertEquals(d("-123.45"), cash);
    }
}
