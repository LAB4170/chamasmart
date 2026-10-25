package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.payments.PaystackProvider;
import com.chamasmart.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SubscriptionServiceTest {
    SubscriptionPlanRepository plans = mock(SubscriptionPlanRepository.class);
    ChamaSubscriptionRepository subs = mock(ChamaSubscriptionRepository.class);
    ChamaRepository chamas = mock(ChamaRepository.class);
    ChamaMemberRepository members = mock(ChamaMemberRepository.class);
    MembershipService membership = mock(MembershipService.class);
    NotificationRepository notifications = mock(NotificationRepository.class);
    UserRepository users = mock(UserRepository.class);
    PaystackProvider paystack = mock(PaystackProvider.class);
    SubscriptionService service;
    SubscriptionPlan starter = SubscriptionPlan.builder().planCode("STARTER").displayName("Starter").maxMembers(30).price(BigDecimal.ZERO).currency("KES").intervalMonths(1).active(true).build();
    SubscriptionPlan growth = SubscriptionPlan.builder().planCode("GROWTH").displayName("Growth").maxMembers(150).price(new BigDecimal("1500")).currency("KES").intervalMonths(1).active(true).build();

    @BeforeEach
    void setUp() {
        service = new SubscriptionService(plans, subs, chamas, members, membership, notifications, users, paystack);
        when(plans.findById("STARTER")).thenReturn(Optional.of(starter));
        when(plans.findById("GROWTH")).thenReturn(Optional.of(growth));
        when(subs.save(any())).thenAnswer(i -> i.getArgument(0));
        when(chamas.existsById(3L)).thenReturn(true);
        when(members.findByChamaChamaIdAndIsActiveTrue(3L)).thenReturn(List.of());
    }

    @Test
    void aPaidPlanStartsOnAThirtyDayTrial() {
        when(subs.findFirstByChamaIdOrderBySubscriptionIdDesc(3L)).thenReturn(Optional.empty());
        ArgumentCaptorHolder h = new ArgumentCaptorHolder();
        when(members.findByChamaChamaIdAndUserUserId(anyLong(), anyLong())).thenReturn(Optional.of(ChamaMember.builder().isActive(true).build()));
        service.choose(3L, 1L, "growth");
        verify(subs).save(argThat(s -> "TRIAL".equals(s.getStatus()) && s.getCurrentPeriodEnd().isAfter(ZonedDateTime.now().plusDays(29))));
    }

    static class ArgumentCaptorHolder {}

    @Test
    void aPlanTooSmallForTheMembershipIsRefused() {
        List<ChamaMember> many = new ArrayList<>();
        for (int i = 0; i < 31; i++) many.add(ChamaMember.builder().isActive(true).build());
        when(members.findByChamaChamaIdAndIsActiveTrue(3L)).thenReturn(many);
        assertThrows(IllegalStateException.class, () -> service.choose(3L, 1L, "STARTER"));
    }

    @Test
    void paymentActivatesForOneIntervalAndWrongAmountOrCurrencyIsRefused() {
        ChamaSubscription s = ChamaSubscription.builder().chamaId(3L).planCode("GROWTH").status("PAST_DUE").currentPeriodEnd(ZonedDateTime.now().minusDays(2)).build();
        when(subs.findFirstByChamaIdOrderBySubscriptionIdDesc(3L)).thenReturn(Optional.of(s));
        assertNotNull(service.activateFromPayment(3L, "GROWTH", new BigDecimal("1499"), "KES", "SUB-3-X"));
        assertNotNull(service.activateFromPayment(3L, "GROWTH", new BigDecimal("1500"), "USD", "SUB-3-X"));
        assertNotNull(service.activateFromPayment(3L, "NOPE", new BigDecimal("1500"), "KES", "SUB-3-X"));
        assertEquals("PAST_DUE", s.getStatus());
        assertNull(service.activateFromPayment(3L, "GROWTH", new BigDecimal("1500.00"), "KES", "SUB-3-X"));
        assertEquals("ACTIVE", s.getStatus());
        assertTrue(s.getCurrentPeriodEnd().isAfter(ZonedDateTime.now().plusDays(27)));
    }

    @Test
    void sweepMovesUnpaidToPastDueThenSuspendedAfterGrace() {
        ChamaSubscription trial = ChamaSubscription.builder().chamaId(3L).planCode("GROWTH").status("TRIAL").currentPeriodEnd(ZonedDateTime.now().minusHours(1)).build();
        ChamaSubscription late = ChamaSubscription.builder().chamaId(4L).planCode("GROWTH").status("PAST_DUE").currentPeriodEnd(ZonedDateTime.now().minusDays(8)).build();
        ChamaSubscription fresh = ChamaSubscription.builder().chamaId(5L).planCode("GROWTH").status("PAST_DUE").currentPeriodEnd(ZonedDateTime.now().minusDays(2)).build();
        when(subs.findByStatusInAndCurrentPeriodEndBefore(any(), any())).thenReturn(List.of(trial, late, fresh));
        assertEquals(2, service.sweep());
        assertEquals("PAST_DUE", trial.getStatus());
        assertEquals("SUSPENDED", late.getStatus());
        assertEquals("PAST_DUE", fresh.getStatus());
    }

    @Test
    void suspendedChamasAreFlaggedButNothingIsDeleted() {
        when(subs.findFirstByChamaIdOrderBySubscriptionIdDesc(3L)).thenReturn(Optional.of(ChamaSubscription.builder().status("SUSPENDED").build()));
        assertFalse(service.allowsNewActivity(3L));
        when(subs.findFirstByChamaIdOrderBySubscriptionIdDesc(4L)).thenReturn(Optional.empty());
        assertTrue(service.allowsNewActivity(4L));
    }
}
