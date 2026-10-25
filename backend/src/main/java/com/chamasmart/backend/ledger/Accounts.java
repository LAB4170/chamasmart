package com.chamasmart.backend.ledger;

/** The chart of accounts. Every chama has the same set; balances are kept per chama. */
public final class Accounts {
    private Accounts() {}

    // Assets (normal balance: debit)
    public static final String CASH = "CASH";                       // the chama fund held in its bank, paybill or M-Pesa account
    public static final String WELFARE_CASH = "WELFARE_CASH";       // the welfare fund's cash
    public static final String LOANS_RECEIVABLE = "LOANS_RECEIVABLE"; // principal, interest and fees owed by borrowers
    public static final String SUSPENSE = "SUSPENSE";               // anything that could not be classified; must be cleared to zero

    // Liabilities and equity (normal balance: credit)
    public static final String MEMBER_SAVINGS = "MEMBER_SAVINGS";   // what the chama owes members for their savings
    public static final String WELFARE_RESERVE = "WELFARE_RESERVE"; // the welfare fund owed to its purpose
    public static final String COVER_RESERVE = "COVER_RESERVE";     // loan cover premiums held back
    public static final String ASCA_EQUITY = "ASCA_EQUITY";         // members' share capital in an ASCA cycle

    // Income (normal balance: credit)
    public static final String INTEREST_INCOME = "INTEREST_INCOME";
    public static final String FEE_INCOME = "FEE_INCOME";
    public static final String FINES_INCOME = "FINES_INCOME";      // unpaid fines taken from a departing member's savings
}
