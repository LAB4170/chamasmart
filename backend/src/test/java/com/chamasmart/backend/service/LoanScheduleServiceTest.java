package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LoanScheduleServiceTest {
    @Mock LoanInstallmentRepository installmentRepo;
    @Mock LoanConfigRepository configRepo;
    @Mock LoanRepository loanRepo;
    @Mock LedgerService ledger;
    LoanScheduleService service;
    Chama chama;
    Loan loan;
    final List<LoanInstallment> store = new ArrayList<>();
    final LocalDate approved = LocalDate.of(2026, 1, 1);

    @BeforeEach
    void setUp() {
        chama = Chama.builder().chamaId(1L).chamaName("G").build();
        User b = new User(); b.setUserId(5L);
        loan = Loan.builder().loanId(3L).chama(chama).borrower(b).loanAmount(new BigDecimal("1200")).termMonths(3).interestRate(new BigDecimal("12"))
                .interestType("FLAT").totalRepayable(new BigDecimal("1236")).amountPaid(BigDecimal.ZERO).status("ACTIVE")
                .approvedAt(approved.atStartOfDay(ZoneId.systemDefault())).build();
        when(installmentRepo.findByLoanLoanIdOrderByNumberAsc(3L)).thenAnswer(i -> new ArrayList<>(store));
        when(installmentRepo.saveAll(any())).thenAnswer(i -> { Iterable<LoanInstallment> it = i.getArgument(0); it.forEach(r -> { if (!store.contains(r)) store.add(r); }); return new ArrayList<>(store); });
        doAnswer(i -> { Iterable<LoanInstallment> it = i.getArgument(0); it.forEach(store::remove); return null; }).when(installmentRepo).deleteAll(any());
        when(installmentRepo.save(any(LoanInstallment.class))).thenAnswer(i -> i.getArgument(0));
        when(loanRepo.findByStatus(anyString())).thenReturn(List.of());
        when(loanRepo.findByStatus("ACTIVE")).thenReturn(List.of(loan));
        service = new LoanScheduleService(installmentRepo, configRepo, loanRepo, ledger);
    }

    @Test void scheduleIsStoredAndAddsUpToWhatIsOwed() {
        List<LoanInstallment> rows = service.generate(loan);
        assertEquals(3, rows.size());
        assertEquals(0, new BigDecimal("1236").compareTo(rows.stream().map(LoanInstallment::due).reduce(BigDecimal.ZERO, BigDecimal::add)));
    }

    @Test void paymentsPayFeesThenInterestThenPrincipalOldestFirst() {
        service.generate(loan);
        store.get(0).setFee(new BigDecimal("10"));
        service.apply(loan, chama, new BigDecimal("50"), 7L);
        LoanInstallment first = store.get(0);
        assertEquals(0, new BigDecimal("10").compareTo(first.getPaidFee()));
        assertEquals(0, first.getInterest().compareTo(first.getPaidInterest()));
        assertEquals(0, new BigDecimal("50").subtract(new BigDecimal("10")).subtract(first.getInterest()).compareTo(first.getPaidPrincipal()));
        assertEquals(0, store.get(1).paid().signum());
        verify(ledger).post(eq(chama), eq("FEE_INCOME"), eq(new BigDecimal("10")), any(), any(), any(), eq(7L), any());
    }

    @Test void loansWithoutAStoredScheduleGetOneWithEarlierPaymentsApplied() {
        loan.setAmountPaid(new BigDecimal("400"));
        List<LoanInstallment> rows = service.ensure(loan);
        assertEquals(0, new BigDecimal("400").compareTo(rows.stream().map(LoanInstallment::paid).reduce(BigDecimal.ZERO, BigDecimal::add)));
    }

    @Test void lateFeeIsChargedOnceAndAddedToWhatIsOwed() {
        service.generate(loan);
        when(configRepo.findByChamaId(1L)).thenReturn(Optional.of(LoanConfig.builder().chamaId(1L).lateFeePercent(new BigDecimal("5")).build()));
        LocalDate later = approved.plusMonths(1).plusDays(3);
        assertEquals(1, service.chargeLateFees(later));
        assertEquals(0, new BigDecimal("1236").add(store.get(0).getFee()).compareTo(loan.getTotalRepayable()));
        assertTrue(store.get(0).getFee().signum() > 0);
        assertEquals(0, service.chargeLateFees(later));
    }

    @Test void noLateFeeWhenThePolicyIsOff() {
        service.generate(loan);
        when(configRepo.findByChamaId(1L)).thenReturn(Optional.empty());
        assertEquals(0, service.chargeLateFees(approved.plusMonths(2)));
    }

    @Test void rescheduleSpreadsWhatIsLeftAndKeepsPaidInstalments() {
        service.generate(loan);
        service.apply(loan, chama, new BigDecimal("412"), 7L); // clears instalment 1 exactly
        loan.setAmountPaid(new BigDecimal("412"));
        service.reschedule(loan, 4, LocalDate.of(2026, 6, 1));
        assertEquals(5, store.size());
        assertEquals(0, new BigDecimal("824").compareTo(store.stream().skip(1).map(LoanInstallment::due).reduce(BigDecimal.ZERO, BigDecimal::add)));
        assertEquals(LocalDate.of(2026, 10, 1), store.get(4).getDueDate());
    }

    @Test void overdueIsNullWithoutAStoredScheduleAndCountsUnpaidDueRowsWithOne() {
        assertNull(service.overdue(loan, approved.plusMonths(5)));
        service.generate(loan);
        assertTrue(service.overdue(loan, approved.plusMonths(2).plusDays(1)).compareTo(new BigDecimal("800")) > 0);
    }
}
