package com.chamasmart.backend.ledger;

import com.chamasmart.backend.domain.LedgerEntry;

import java.math.BigDecimal;
import java.util.List;

/**
 * Turns one single-entry ledger posting into a balanced pair of lines. The rules mirror what each money path does today;
 * anything the rules do not know lands in SUSPENSE, which must read zero, so a new kind of posting cannot hide.
 */
public final class JournalMapper {
    private JournalMapper() {}

    public record Line(String account, BigDecimal debit, BigDecimal credit) {
        public static Line debit(String account, BigDecimal amount) { return new Line(account, amount, BigDecimal.ZERO); }
        public static Line credit(String account, BigDecimal amount) { return new Line(account, BigDecimal.ZERO, amount); }
    }

    public static List<Line> map(String legacyAccount, BigDecimal signedAmount, String entryType) {
        if (signedAmount == null || signedAmount.signum() == 0) return List.of();
        boolean inflow = signedAmount.signum() > 0;
        BigDecimal a = signedAmount.abs();

        if (LedgerEntry.WELFARE_FUND.equals(legacyAccount)) {
            return inflow ? pair(Accounts.WELFARE_CASH, Accounts.WELFARE_RESERVE, a) : pair(Accounts.WELFARE_RESERVE, Accounts.WELFARE_CASH, a);
        }
        if ("INTEREST_INCOME".equals(legacyAccount)) return pair(Accounts.LOANS_RECEIVABLE, Accounts.INTEREST_INCOME, signedAmount);
        if ("FEE_INCOME".equals(legacyAccount)) return pair(Accounts.LOANS_RECEIVABLE, Accounts.FEE_INCOME, signedAmount);

        if (!LedgerEntry.CHAMA_FUND.equals(legacyAccount)) return inflow ? pair(Accounts.SUSPENSE, Accounts.SUSPENSE, a) : List.of();

        // The fund's cash moved by signedAmount. The other side depends on why.
        String other = switch (entryType == null ? "" : entryType) {
            case "CONTRIBUTION", "MPESA_CONTRIBUTION", "REVERSAL", "MEMBER_EXIT_REFUND", "ROSCA_POT_PAYOUT" -> Accounts.MEMBER_SAVINGS;
            case "LOAN_DISBURSEMENT", "LOAN_REPAYMENT" -> Accounts.LOANS_RECEIVABLE;
            case "EXPENSE_PAYOUT" -> Accounts.EXPENSES;
            case "ASCA_SHARE_PURCHASE", "ASCA_SHARE_OUT" -> Accounts.ASCA_EQUITY;
            default -> Accounts.SUSPENSE;
        };
        return inflow ? pair(Accounts.CASH, other, a) : pair(other, Accounts.CASH, a);
    }

    private static List<Line> pair(String debit, String credit, BigDecimal amount) {
        if (amount.signum() < 0) return pair(credit, debit, amount.negate());
        return List.of(Line.debit(debit, amount), Line.credit(credit, amount));
    }
}
