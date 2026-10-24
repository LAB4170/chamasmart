package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * T-03 and T-04: the stored repayment schedule, the order payments are applied in, late fees, and income tracking.
 * A payment pays fees first, then interest, then principal, oldest instalment first.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LoanScheduleService {
    public static final String INTEREST_INCOME = "INTEREST_INCOME";
    public static final String FEE_INCOME = "FEE_INCOME";

    private final LoanInstallmentRepository installmentRepository;
    private final LoanConfigRepository configRepository;
    private final LoanRepository loanRepository;
    private final LedgerService ledger;

    /** Builds and saves the schedule when a loan is approved. */
    @Transactional
    public List<LoanInstallment> generate(Loan loan) {
        String type = loan.getInterestType() != null ? loan.getInterestType() : LoanCalculator.FLAT;
        LocalDate start = (loan.getApprovedAt() != null ? loan.getApprovedAt() : loan.getCreatedAt()).toLocalDate();
        BigDecimal interest = loan.getTotalRepayable().subtract(loan.getLoanAmount());
        List<LoanInstallment> rows = new ArrayList<>();
        for (LoanCalculator.Installment i : LoanCalculator.schedule(loan.getLoanAmount(), loan.getInterestRate(), loan.getTermMonths(), type, start, interest)) {
            rows.add(LoanInstallment.builder().loan(loan).number(i.number()).dueDate(i.dueDate()).principal(i.principal()).interest(i.interest()).build());
        }
        return installmentRepository.saveAll(rows);
    }

    /**
     * The loan's stored schedule. Loans approved before schedules were stored get one built on first use,
     * with what was already paid applied in order. Call this BEFORE adding a new payment to loan.amountPaid.
     */
    @Transactional
    public List<LoanInstallment> ensure(Loan loan) {
        List<LoanInstallment> existing = installmentRepository.findByLoanLoanIdOrderByNumberAsc(loan.getLoanId());
        if (!existing.isEmpty()) return existing;
        if (loan.getTermMonths() == null || loan.getTotalRepayable() == null || loan.getLoanAmount() == null) return existing;
        List<LoanInstallment> rows = generate(loan);
        BigDecimal alreadyPaid = loan.getAmountPaid() == null ? BigDecimal.ZERO : loan.getAmountPaid();
        if (alreadyPaid.signum() > 0) allocate(rows, alreadyPaid);
        return installmentRepository.saveAll(rows);
    }

    /** Applies a verified payment to the schedule and records the interest and fee parts as income. */
    @Transactional
    public void apply(Loan loan, Chama chama, BigDecimal amount, Long actorId) {
        List<LoanInstallment> rows = ensure(loan);
        if (rows.isEmpty()) return;
        BigDecimal[] parts = allocate(rows, amount);
        installmentRepository.saveAll(rows);
        ledger.post(chama, INTEREST_INCOME, parts[1], "LOAN_INTEREST", "LOAN", loan.getLoanId(), actorId, "Interest received on loan " + loan.getLoanId());
        ledger.post(chama, FEE_INCOME, parts[2], "LOAN_FEE", "LOAN", loan.getLoanId(), actorId, "Late fees received on loan " + loan.getLoanId());
    }

    /** Returns {principal, interest, fee} actually applied. */
    static BigDecimal[] allocate(List<LoanInstallment> rows, BigDecimal amount) {
        BigDecimal left = amount;
        BigDecimal p = BigDecimal.ZERO, in = BigDecimal.ZERO, f = BigDecimal.ZERO;
        for (LoanInstallment r : rows) {
            if (left.signum() <= 0) break;
            BigDecimal x = left.min(r.getFee().subtract(r.getPaidFee()).max(BigDecimal.ZERO));
            r.setPaidFee(r.getPaidFee().add(x)); left = left.subtract(x); f = f.add(x);
            x = left.min(r.getInterest().subtract(r.getPaidInterest()).max(BigDecimal.ZERO));
            r.setPaidInterest(r.getPaidInterest().add(x)); left = left.subtract(x); in = in.add(x);
            x = left.min(r.getPrincipal().subtract(r.getPaidPrincipal()).max(BigDecimal.ZERO));
            r.setPaidPrincipal(r.getPaidPrincipal().add(x)); left = left.subtract(x); p = p.add(x);
        }
        return new BigDecimal[]{p, in, f};
    }

    /** What should have been paid by {@code today} and has not. */
    @Transactional(readOnly = true)
    public BigDecimal overdue(Loan loan, LocalDate today) {
        List<LoanInstallment> rows = installmentRepository.findByLoanLoanIdOrderByNumberAsc(loan.getLoanId());
        if (rows.isEmpty()) return null; // no stored schedule; caller falls back to the derived one
        return rows.stream().filter(r -> r.getDueDate().isBefore(today)).map(LoanInstallment::unpaid).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** The last stored due date, or null when the loan has no stored schedule. */
    @Transactional(readOnly = true)
    public LocalDate lastDueDate(Loan loan) {
        List<LoanInstallment> rows = installmentRepository.findByLoanLoanIdOrderByNumberAsc(loan.getLoanId());
        return rows.isEmpty() ? null : rows.stream().map(LoanInstallment::getDueDate).max(LocalDate::compareTo).orElse(null);
    }

    /** Nightly: each overdue, unpaid instalment gets the chama's late fee once. The fee is added to what the loan owes. */
    @Transactional
    public int chargeLateFees(LocalDate today) {
        int charged = 0;
        for (String status : List.of("APPROVED", "DISBURSED", "ACTIVE", "DEFAULTED")) {
            for (Loan loan : loanRepository.findByStatus(status)) {
                BigDecimal pct = configRepository.findByChamaId(loan.getChama().getChamaId()).map(LoanConfig::getLateFeePercent).orElse(BigDecimal.ZERO);
                if (pct == null || pct.signum() <= 0) continue;
                for (LoanInstallment r : ensure(loan)) {
                    if (Boolean.TRUE.equals(r.getFeeApplied()) || !r.getDueDate().isBefore(today) || r.unpaid().signum() <= 0) continue;
                    BigDecimal fee = r.unpaid().multiply(pct).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                    r.setFee(r.getFee().add(fee));
                    r.setFeeApplied(true);
                    installmentRepository.save(r);
                    loan.setTotalRepayable(loan.getTotalRepayable().add(fee));
                    loanRepository.save(loan);
                    charged++;
                }
            }
        }
        if (charged > 0) log.info("Charged {} late fee(s)", charged);
        return charged;
    }

    /**
     * Re-plans what is still unpaid over {@code months} new monthly instalments starting next month.
     * Instalments that have any payment on them stay as they are.
     */
    @Transactional
    public void reschedule(Loan loan, int months, LocalDate today) {
        List<LoanInstallment> rows = ensure(loan);
        List<LoanInstallment> untouched = rows.stream().filter(r -> r.paid().signum() == 0).toList();
        BigDecimal p = BigDecimal.ZERO, in = BigDecimal.ZERO, f = BigDecimal.ZERO;
        for (LoanInstallment r : untouched) { p = p.add(r.getPrincipal()); in = in.add(r.getInterest()); f = f.add(r.getFee()); }
        List<LoanInstallment> kept = rows.stream().filter(r -> r.paid().signum() > 0).toList();
        // A part-paid instalment's remainder is carried into the new plan.
        for (LoanInstallment r : kept) {
            BigDecimal rp = r.getPrincipal().subtract(r.getPaidPrincipal()), ri = r.getInterest().subtract(r.getPaidInterest()), rf = r.getFee().subtract(r.getPaidFee());
            if (rp.add(ri).add(rf).signum() > 0) {
                p = p.add(rp); in = in.add(ri); f = f.add(rf);
                r.setPrincipal(r.getPaidPrincipal()); r.setInterest(r.getPaidInterest()); r.setFee(r.getPaidFee());
                installmentRepository.save(r);
            }
        }
        installmentRepository.deleteAll(untouched);
        int base = kept.size();
        BigDecimal pLeft = p, iLeft = in, fLeft = f;
        List<LoanInstallment> fresh = new ArrayList<>();
        for (int k = 1; k <= months; k++) {
            boolean last = k == months;
            BigDecimal pp = last ? pLeft : p.divide(BigDecimal.valueOf(months), 2, RoundingMode.HALF_UP);
            BigDecimal ii = last ? iLeft : in.divide(BigDecimal.valueOf(months), 2, RoundingMode.HALF_UP);
            BigDecimal ff = last ? fLeft : f.divide(BigDecimal.valueOf(months), 2, RoundingMode.HALF_UP);
            pLeft = pLeft.subtract(pp); iLeft = iLeft.subtract(ii); fLeft = fLeft.subtract(ff);
            fresh.add(LoanInstallment.builder().loan(loan).number(base + k).dueDate(today.plusMonths(k)).principal(pp).interest(ii).fee(ff)
                    .feeApplied(ff.signum() > 0).build());
        }
        installmentRepository.saveAll(fresh);
        loan.setTermMonths(base + months);
        loan.setMonthlyPayment(p.add(in).add(f).divide(BigDecimal.valueOf(months), 2, RoundingMode.HALF_UP));
        loanRepository.save(loan);
    }
}
