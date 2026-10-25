package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PayoutServiceTest {
    PayoutRepository payouts = mock(PayoutRepository.class);
    PayoutApprovalRepository approvals = mock(PayoutApprovalRepository.class);
    ChamaRepository chamas = mock(ChamaRepository.class);
    MembershipService membership = mock(MembershipService.class);
    UserRepository users = mock(UserRepository.class);
    LedgerService ledger = mock(LedgerService.class);
    FinancialAuditLogRepository audit = mock(FinancialAuditLogRepository.class);
    NotificationRepository notes = mock(NotificationRepository.class);
    ChamaMemberRepository members = mock(ChamaMemberRepository.class);
    EnforcementService enforcement = mock(EnforcementService.class);
    VerificationService verification = mock(VerificationService.class);
    PayoutService service;
    Chama chama;
    Map<Long, Payout> store = new HashMap<>();
    List<PayoutApproval> given = new ArrayList<>();
    long next = 1;

    @BeforeEach
    void setUp() {
        service = new PayoutService(payouts, approvals, chamas, membership, users, ledger, audit, notes, members, enforcement, verification);
        chama = Chama.builder().chamaId(3L).chamaName("T").currentFund(new BigDecimal("300000")).build();
        when(chamas.findById(3L)).thenReturn(Optional.of(chama));
        when(chamas.findByIdWithPessimisticLock(3L)).thenReturn(Optional.of(chama));
        when(payouts.save(any())).thenAnswer(i -> { Payout p = i.getArgument(0); if (p.getPayoutId() == null) p.setPayoutId(next++); store.put(p.getPayoutId(), p); return p; });
        when(payouts.lockById(anyLong())).thenAnswer(i -> Optional.ofNullable(store.get(i.getArgument(0))));
        when(payouts.committedSince(anyLong(), any())).thenReturn(BigDecimal.ZERO);
        when(payouts.findByRequestedByAndIdempotencyKey(anyLong(), anyString())).thenReturn(Optional.empty());
        when(approvals.save(any())).thenAnswer(i -> { given.add(i.getArgument(0)); return i.getArgument(0); });
        when(approvals.findByPayoutId(anyLong())).thenAnswer(i -> given.stream().filter(a -> a.getPayoutId().equals(i.getArgument(0))).toList());
        when(approvals.existsByPayoutIdAndApproverId(anyLong(), anyLong())).thenAnswer(i -> given.stream().anyMatch(a -> a.getPayoutId().equals(i.getArgument(0)) && a.getApproverId().equals(i.getArgument(1))));
        when(members.findByChamaChamaIdAndIsActiveTrue(3L)).thenReturn(List.of());
        when(users.findById(anyLong())).thenAnswer(i -> Optional.of(User.builder().userId(i.getArgument(0)).build()));
    }

    Long ask(String amount) { return (Long) service.request(3L, 1L, new BigDecimal(amount), "Venue", "0712345678", "Hall hire for AGM", "k" + next).get("payout_id"); }

    @Test
    void requesterCannotApproveOwnPayoutAndOneApprovalClearsASmallOne() {
        Long id = ask("5000");
        assertThrows(AccessDeniedException.class, () -> service.approve(3L, 1L, id));
        assertEquals("APPROVED", service.approve(3L, 2L, id).get("status"));
        assertThrows(IllegalStateException.class, () -> service.approve(3L, 4L, id));
    }

    @Test
    void largePayoutNeedsTwoOtherOfficials() {
        Long id = ask("150000");
        assertEquals("REQUESTED", service.approve(3L, 2L, id).get("status"));
        assertThrows(IllegalStateException.class, () -> service.approve(3L, 2L, id));
        assertEquals("APPROVED", service.approve(3L, 4L, id).get("status"));
    }

    @Test
    void theFirstPayoutAndLargeOnesAreHeldThenFundAndJournalMoveOnlyWhenPaid() {
        Long id = ask("5000");
        service.approve(3L, 2L, id);
        assertTrue(store.get(id).getReleaseAt().isAfter(ZonedDateTime.now().plusHours(23)));
        assertThrows(IllegalStateException.class, () -> service.markPaid(3L, 1L, id, "SJK1234567"));
        assertEquals(new BigDecimal("300000"), chama.getCurrentFund());
        store.get(id).setReleaseAt(ZonedDateTime.now().minusMinutes(1));
        assertThrows(IllegalArgumentException.class, () -> service.markPaid(3L, 1L, id, "12"));
        service.markPaid(3L, 1L, id, "sjk 1234567");
        assertEquals(new BigDecimal("295000.00"), chama.getCurrentFund());
        verify(ledger).post(eq(chama), eq(LedgerEntry.CHAMA_FUND), eq(new BigDecimal("-5000.00")), eq("EXPENSE_PAYOUT"), eq("PAYOUT"), eq(id), eq(1L), anyString());
        assertEquals("SJK1234567", store.get(id).getPaymentReference());
        assertThrows(IllegalStateException.class, () -> service.markPaid(3L, 1L, id, "SJK7654321"));
    }

    @Test
    void laterSmallPayoutsAreNotHeldOnceOneHasBeenPaid() {
        when(payouts.existsByChamaIdAndStatus(3L, "PAID")).thenReturn(true);
        Long id = ask("2000");
        service.approve(3L, 2L, id);
        assertFalse(store.get(id).getReleaseAt().isAfter(ZonedDateTime.now().plusSeconds(5)));
    }

    @Test
    void anOpenFreezeStopsRequestsApprovalsAndPayments() {
        Long id = ask("2000");
        when(enforcement.frozen(3L)).thenReturn(true);
        assertThrows(IllegalStateException.class, () -> ask("1000"));
        assertThrows(IllegalStateException.class, () -> service.approve(3L, 2L, id));
        assertThrows(IllegalStateException.class, () -> service.markPaid(3L, 2L, id, "SJK1ABC000"));
    }

    @Test
    void aNewlyListedChamaHoldsEvenSmallPayoutsLongerAndHasALowerDailyCap() {
        when(payouts.existsByChamaIdAndStatus(3L, "PAID")).thenReturn(true);
        when(verification.recentlyListed(eq(3L), anyInt())).thenReturn(true);
        Long id = ask("2000");
        service.approve(3L, 2L, id);
        assertTrue(store.get(id).getReleaseAt().isAfter(ZonedDateTime.now().plusHours(70)));
        when(payouts.committedSince(anyLong(), any())).thenReturn(new BigDecimal("99000"));
        assertThrows(IllegalStateException.class, () -> ask("2000"));
    }

    @Test
    void limitsAndInputChecks() {
        when(payouts.committedSince(anyLong(), any())).thenReturn(new BigDecimal("450000"));
        assertThrows(IllegalStateException.class, () -> ask("60000"));
        when(payouts.committedSince(anyLong(), any())).thenReturn(BigDecimal.ZERO);
        assertThrows(IllegalStateException.class, () -> ask("300001"));
        assertThrows(IllegalArgumentException.class, () -> service.request(3L, 1L, new BigDecimal("100"), "V", "0712345678", "Hall hire", "x"));
        assertThrows(IllegalArgumentException.class, () -> service.request(3L, 1L, new BigDecimal("100"), "Venue", "123", "Hall hire", "x"));
        assertThrows(IllegalArgumentException.class, () -> service.request(3L, 1L, new BigDecimal("100"), "Venue", null, "no", "x"));
        assertEquals("254712345678", PayoutService.normalisePhone("+254 712-345-678"));
    }

    @Test
    void rejectNeedsAReasonAndCancelIsForTheRequesterOnly() {
        Long id = ask("1000");
        assertThrows(IllegalArgumentException.class, () -> service.reject(3L, 2L, id, " "));
        assertThrows(AccessDeniedException.class, () -> service.cancel(3L, 2L, id));
        assertEquals("CANCELLED", service.cancel(3L, 1L, id).get("status"));
        assertThrows(IllegalStateException.class, () -> service.approve(3L, 2L, id));
    }

    @Test
    void anOverduePlanPausesNewPayoutRequestsOnly() {
        SubscriptionService subs = mock(SubscriptionService.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service, "subscriptions", subs);
        when(subs.allowsNewActivity(3L)).thenReturn(false);
        IllegalStateException e = assertThrows(IllegalStateException.class, () -> ask("5000"));
        assertTrue(e.getMessage().contains("plan is overdue"));
        when(subs.allowsNewActivity(3L)).thenReturn(true);
        assertNotNull(ask("5000"));
    }
}
