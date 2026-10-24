package com.chamasmart.backend.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Loan arithmetic in one place. Rates are annual percentages; terms are in months.
 *  FLAT:              interest = principal x rate x months / 1200
 *  REDUCING_BALANCE:  equal principal instalments, interest charged monthly on the remaining balance.
 */
public final class LoanCalculator {
    public static final String FLAT = "FLAT";
    public static final String REDUCING = "REDUCING_BALANCE";
    private static final BigDecimal MONTHS_PER_100 = BigDecimal.valueOf(1200);

    private LoanCalculator() {}

    public static boolean isSupportedType(String type) {
        return FLAT.equals(type) || REDUCING.equals(type);
    }

    public static BigDecimal totalInterest(BigDecimal principal, BigDecimal annualRate, int months, String type) {
        BigDecimal base = principal.multiply(annualRate).divide(MONTHS_PER_100, 10, RoundingMode.HALF_UP);
        BigDecimal factor = REDUCING.equals(type)
                ? BigDecimal.valueOf(months + 1L).divide(BigDecimal.valueOf(2), 10, RoundingMode.HALF_UP)
                : BigDecimal.valueOf(months);
        return base.multiply(factor).setScale(2, RoundingMode.HALF_UP);
    }

    public record Installment(int number, LocalDate dueDate, BigDecimal principal, BigDecimal interest, BigDecimal total, BigDecimal balanceAfter) {}

    /** Instalments that always sum exactly to principal + totalInterest (the last one absorbs rounding). */
    public static List<Installment> schedule(BigDecimal principal, BigDecimal annualRate, int months, String type, LocalDate start, BigDecimal totalInterest) {
        List<Installment> out = new ArrayList<>();
        BigDecimal remainingPrincipal = principal;
        BigDecimal interestLeft = totalInterest;
        BigDecimal monthlyRate = annualRate.divide(MONTHS_PER_100, 10, RoundingMode.HALF_UP);
        BigDecimal outstanding = principal.add(totalInterest);
        for (int i = 1; i <= months; i++) {
            boolean last = i == months;
            BigDecimal p = last ? remainingPrincipal : principal.divide(BigDecimal.valueOf(months), 2, RoundingMode.HALF_UP);
            BigDecimal in;
            if (last) {
                in = interestLeft;
            } else if (REDUCING.equals(type)) {
                in = remainingPrincipal.multiply(monthlyRate).setScale(2, RoundingMode.HALF_UP);
            } else {
                in = totalInterest.divide(BigDecimal.valueOf(months), 2, RoundingMode.HALF_UP);
            }
            remainingPrincipal = remainingPrincipal.subtract(p);
            interestLeft = interestLeft.subtract(in);
            BigDecimal total = p.add(in);
            outstanding = outstanding.subtract(total);
            out.add(new Installment(i, start.plusMonths(i), p, in, total, outstanding));
        }
        return out;
    }
}
