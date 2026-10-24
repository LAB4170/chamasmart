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
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class LoanCoverServiceTest {
    @Mock LoanRepository loans;
    @Mock LoanConfigRepository configs;
    @Mock LoanCoverClaimRepository claims;
    @Mock ChamaMemberRepository members;
    @Mock LoanScheduleService schedule;
    @Mock FinancialAuditLogRepository audit;
    @Mock UserRepository users;
    @Mock NotificationRepository notifs;
    LoanCoverService service;
    Chama chama;
    Loan loan;
    ChamaMember treasurer, secretary, borrowerMember;

    private static User user(long id) { User u = new User(); u.setUserId(id); u.setFirstName("U" + id); return u; }
    private ChamaMember member(long id, String role) {
        ChamaMember m = ChamaMember.builder().chama(chama).user(user(id)).role(role).isActive(true).build();
        when(members.findByChamaChamaIdAndUserUserId(1L, id)).thenReturn(Optional.of(m));
        return m;
    }

    @BeforeEach
    void setUp() {
        chama = Chama.builder().chamaId(1L).chamaName("G").build();
        loan = Loan.builder().loanId(4L).chama(chama).borrower(user(8)).status("ACTIVE").totalRepayable(new BigDecimal("11000"))
                .amountPaid(new BigDecimal("1000")).coverPremium(new BigDecimal("200")).build();
        treasurer = member(7, "TREASURER"); secretary = member(6, "SECRETARY"); borrowerMember = member(8, "MEMBER");
        when(members.findByChamaChamaIdAndIsActiveTrue(1L)).thenReturn(List.of(treasurer, secretary, borrowerMember));
        when(loans.findByIdWithPessimisticLock(4L)).thenReturn(Optional.of(loan));
        when(loans.coverReserve(1L)).thenReturn(new BigDecimal("6000"));
        when(claims.save(any())).thenAnswer(i -> { LoanCoverClaim c = i.getArgument(0); if (c.getClaimId() == null) c.setClaimId(1L); return c; });
        service = new LoanCoverService(loans, configs, claims, members, schedule, audit, users, notifs);
    }

    @Test
    void premiumIsAPercentOfTheLoanOrZero() {
        assertEquals(new BigDecimal("200.00"), LoanCoverService.premium(new BigDecimal("10000"), new BigDecimal("2")));
        assertEquals(BigDecimal.ZERO, LoanCoverService.premium(new BigDecimal("10000"), null));
        assertEquals(BigDecimal.ZERO, LoanCoverService.premium(new BigDecimal("10000"), BigDecimal.ZERO));
    }

    @Test
    void premiumPercentIsCappedAndOfficialsOnly() {
        assertThrows(IllegalArgumentException.class, () -> service.setPercent(1L, 7L, new BigDecimal("11")));
        assertThrows(IllegalArgumentException.class, () -> service.setPercent(1L, 7L, new BigDecimal("-1")));
        assertThrows(AccessDeniedException.class, () -> service.setPercent(1L, 8L, new BigDecimal("2")));
        when(configs.findByChamaId(1L)).thenReturn(Optional.empty());
        assertEquals(new BigDecimal("2"), service.setPercent(1L, 7L, new BigDecimal("2")));
    }

    @Test
    void claimNeedsCoverAnOpenLoanAReasonAndNoClaimAlreadyWaiting() {
        loan.setCoverPremium(null);
        assertThrows(IllegalStateException.class, () -> service.request(1L, 4L, 7L, "DEATH", "Family confirmed, certificate seen"));
        loan.setCoverPremium(new BigDecimal("200"));
        assertThrows(IllegalArgumentException.class, () -> service.request(1L, 4L, 7L, "LAZY", "Family confirmed, certificate seen"));
        assertThrows(IllegalArgumentException.class, () -> service.request(1L, 4L, 7L, "DEATH", "short"));
        loan.setStatus("COMPLETED");
        assertThrows(IllegalStateException.class, () -> service.request(1L, 4L, 7L, "DEATH", "Family confirmed, certificate seen"));
        loan.setStatus("ACTIVE");
        when(claims.existsByLoanLoanIdAndStatus(4L, "PENDING")).thenReturn(true);
        assertThrows(IllegalStateException.class, () -> service.request(1L, 4L, 7L, "DEATH", "Family confirmed, certificate seen"));
        when(claims.existsByLoanLoanIdAndStatus(4L, "PENDING")).thenReturn(false);
        assertEquals("PENDING", service.request(1L, 4L, 7L, "death", "Family confirmed, certificate seen").get("status"));
    }

    private LoanCoverClaim pending(long requestedBy) {
        LoanCoverClaim c = LoanCoverClaim.builder().claimId(1L).loan(loan).chamaId(1L).reason("DEATH").details("x").requestedBy(requestedBy).build();
        when(claims.findById(1L)).thenReturn(Optional.of(c));
        return c;
    }

    @Test
    void theRequesterCannotApproveWhenAnotherOfficialIsAvailable() {
        pending(7);
        assertThrows(AccessDeniedException.class, () -> service.decide(1L, 1L, 7L, true, null));
    }

    @Test
    void theBorrowerCannotDecideTheirOwnClaim() {
        pending(7);
        borrowerMember.setRole("TREASURER");
        assertThrows(AccessDeniedException.class, () -> service.decide(1L, 1L, 8L, true, null));
    }

    @Test
    void approvalPaysTheBalanceFromTheReserveAndClosesTheLoan() {
        pending(7);
        when(loans.coverReserve(1L)).thenReturn(new BigDecimal("20000"));
        Map<String, Object> out = service.decide(1L, 1L, 6L, true, "Verified");
        assertEquals(new BigDecimal("10000.00"), out.get("amount_paid"));
        assertEquals("COMPLETED", loan.getStatus());
        assertEquals(0, new BigDecimal("11000").compareTo(loan.getAmountPaid()));
        assertEquals(new BigDecimal("10000.00"), loan.getCoverPaid());
        verify(schedule).apply(eq(loan), eq(chama), eq(new BigDecimal("10000.00")), eq(6L));
    }

    @Test
    void aSmallReservePaysOnlyWhatItHoldsAndTheLoanStaysOpen() {
        pending(7);
        Map<String, Object> out = service.decide(1L, 1L, 6L, true, null);
        assertEquals(new BigDecimal("6000.00"), out.get("amount_paid"));
        assertEquals(new BigDecimal("4000.00"), out.get("still_owed"));
        assertEquals("ACTIVE", loan.getStatus());
    }

    @Test
    void anEmptyReservePaysNothing() {
        pending(7);
        when(loans.coverReserve(1L)).thenReturn(BigDecimal.ZERO);
        assertThrows(IllegalStateException.class, () -> service.decide(1L, 1L, 6L, true, null));
        verify(schedule, never()).apply(any(), any(), any(), any());
    }

    @Test
    void decliningNeedsAReasonAndChangesNothing() {
        pending(7);
        assertThrows(IllegalArgumentException.class, () -> service.decide(1L, 1L, 6L, false, ""));
        assertEquals("REJECTED", service.decide(1L, 1L, 6L, false, "No evidence seen").get("status"));
        assertEquals(new BigDecimal("1000"), loan.getAmountPaid());
    }

    @Test
    void aSoleEligibleOfficialMayDecideTheirOwnRequest() {
        pending(7);
        when(members.findByChamaChamaIdAndIsActiveTrue(1L)).thenReturn(List.of(treasurer, borrowerMember));
        assertEquals("APPROVED", service.decide(1L, 1L, 7L, true, null).get("status"));
    }
}
