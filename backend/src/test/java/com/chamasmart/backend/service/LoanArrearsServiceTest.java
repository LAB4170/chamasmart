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
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LoanArrearsServiceTest {
    @Mock LoanRepository loanRepo;
    @Mock LoanGuarantorRepository guarantorRepo;
    @Mock NotificationRepository notifRepo;
    @Mock ChamaMemberRepository memberRepo;
    LoanArrearsService service;
    Chama chama;
    Loan loan;
    final LocalDate approved = LocalDate.of(2026, 1, 1);

    private static User user(long id) { User u = new User(); u.setUserId(id); u.setFirstName("U" + id); u.setLastName("X"); return u; }

    @BeforeEach
    void setUp() {
        chama = Chama.builder().chamaId(1L).chamaName("G").build();
        loan = Loan.builder().loanId(3L).chama(chama).borrower(user(5)).loanAmount(new BigDecimal("12000")).termMonths(6)
                .interestRate(BigDecimal.ZERO).totalRepayable(new BigDecimal("12000")).amountPaid(BigDecimal.ZERO).status("DISBURSED")
                .approvedAt(approved.atStartOfDay(ZoneId.systemDefault())).build();
        service = new LoanArrearsService(loanRepo, guarantorRepo, notifRepo, memberRepo);
        when(loanRepo.findByStatus("DISBURSED")).thenReturn(List.of(loan));
        when(loanRepo.findByStatus("ACTIVE")).thenReturn(List.of());
        when(loanRepo.findByChamaChamaId(1L)).thenReturn(List.of(loan));
    }

    @Test void nothingIsOverdueBeforeTheFirstInstalment() {
        assertEquals(0, service.overdueAmount(loan, approved.plusDays(5)).signum());
    }

    @Test void overdueIsWhatShouldHaveBeenPaidMinusWhatWas() {
        BigDecimal due = service.overdueAmount(loan, approved.plusMonths(3).plusDays(1));
        assertTrue(due.signum() > 0);
        loan.setAmountPaid(due);
        assertEquals(0, service.overdueAmount(loan, approved.plusMonths(3).plusDays(1)).signum());
    }

    @Test void unpaidLoanIsDefaultedAfterGraceAndGuarantorsAreTold() {
        LoanGuarantor g = new LoanGuarantor(); g.setLoan(loan); g.setGuarantorUser(user(8)); g.setStatus("APPROVED");
        when(guarantorRepo.findByLoanLoanId(3L)).thenReturn(List.of(g));
        assertEquals(0, service.markDefaults(approved.plusMonths(6).plusDays(10)));
        assertEquals("DISBURSED", loan.getStatus());
        assertEquals(1, service.markDefaults(approved.plusMonths(8)));
        assertEquals("DEFAULTED", loan.getStatus());
        verify(notifRepo, times(2)).save(any(Notification.class));
    }

    @Test void paidUpLoanIsNeverDefaulted() {
        loan.setAmountPaid(new BigDecimal("12000"));
        assertEquals(0, service.markDefaults(approved.plusYears(2)));
        assertEquals("DISBURSED", loan.getStatus());
    }

    @Test void onlyOfficialsSeeArrears() {
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 6L)).thenReturn(Optional.of(ChamaMember.builder().chama(chama).user(user(6)).role("MEMBER").isActive(true).build()));
        assertThrows(AccessDeniedException.class, () -> service.arrears(1L, 6L));
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 7L)).thenReturn(Optional.of(ChamaMember.builder().chama(chama).user(user(7)).role("TREASURER").isActive(true).build()));
        assertEquals(1, service.arrears(1L, 7L).size());
    }
}
