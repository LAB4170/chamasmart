package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.ContributionSummaryDto;
import com.chamasmart.backend.payments.ManualProvider;
import com.chamasmart.backend.payments.MpesaProviderStub;
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
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PaymentIntentServiceTest {
    @Mock PaymentIntentRepository intents;
    @Mock ChamaRepository chamas;
    @Mock ChamaMemberRepository members;
    @Mock ContributionRepository contributions;
    @Mock ContributionService contributionService;
    PaymentIntentService service;

    private static User user(long id) { User u = new User(); u.setUserId(id); return u; }

    @BeforeEach
    void setUp() {
        Chama chama = Chama.builder().chamaId(1L).chamaName("G").build();
        when(chamas.findById(1L)).thenReturn(Optional.of(chama));
        when(members.findByChamaChamaIdAndUserUserId(1L, 8L)).thenReturn(Optional.of(ChamaMember.builder().chama(chama).user(user(8)).role("MEMBER").isActive(true).build()));
        when(intents.save(any())).thenAnswer(i -> { PaymentIntent p = i.getArgument(0); if (p.getIntentId() == null) p.setIntentId(3L); return p; });
        service = new PaymentIntentService(intents, chamas, members, contributions, contributionService, List.of(new ManualProvider(), new MpesaProviderStub()));
    }

    @Test
    void onlyConfiguredProvidersCanBeChosen() {
        assertThrows(IllegalStateException.class, () -> service.create(1L, 8L, "CONTRIBUTION", BigDecimal.TEN, "MPESA", "k1"));
        assertThrows(IllegalStateException.class, () -> service.create(1L, 8L, "CONTRIBUTION", BigDecimal.TEN, "CARD", "k1"));
        assertEquals("AWAITING_PAYMENT", service.create(1L, 8L, "contribution", BigDecimal.TEN, null, "k1").get("status"));
    }

    @Test
    void providersListShowsMpesaAsUnavailable() {
        var mpesa = service.providers().stream().filter(p -> "MPESA".equals(p.get("code"))).findFirst().orElseThrow();
        assertEquals(false, mpesa.get("available"));
    }

    @Test
    void aRetriedRequestReturnsTheSameIntent() {
        PaymentIntent existing = PaymentIntent.builder().intentId(3L).chamaId(1L).userId(8L).purpose("FINE").amount(BigDecimal.TEN).provider("MANUAL").idempotencyKey("k1").expiresAt(ZonedDateTime.now().plusHours(1)).build();
        when(intents.findByUserIdAndIdempotencyKey(8L, "k1")).thenReturn(Optional.of(existing));
        assertEquals(3L, service.create(1L, 8L, "FINE", BigDecimal.TEN, null, "k1").get("intent_id"));
        verify(intents, never()).save(any());
    }

    @Test
    void badInputIsRefused() {
        assertThrows(IllegalArgumentException.class, () -> service.create(1L, 8L, "CONTRIBUTION", BigDecimal.ZERO, null, "k"));
        assertThrows(IllegalArgumentException.class, () -> service.create(1L, 8L, "LOAN", BigDecimal.TEN, null, "k"));
        assertThrows(IllegalArgumentException.class, () -> service.create(1L, 8L, "CONTRIBUTION", BigDecimal.TEN, null, " "));
        assertThrows(AccessDeniedException.class, () -> service.create(1L, 99L, "CONTRIBUTION", BigDecimal.TEN, null, "k"));
    }

    private PaymentIntent awaiting(ZonedDateTime expires) {
        PaymentIntent i = PaymentIntent.builder().intentId(3L).chamaId(1L).userId(8L).purpose("FINE").amount(new BigDecimal("50")).provider("MANUAL").idempotencyKey("k").expiresAt(expires).build();
        when(intents.findById(3L)).thenReturn(Optional.of(i));
        return i;
    }

    @Test
    void submitCreatesAPendingContributionOfTheRightTypeAndNothingIsCredited() {
        PaymentIntent i = awaiting(ZonedDateTime.now().plusHours(1));
        ContributionSummaryDto dto = new ContributionSummaryDto(); dto.setContribution_id(77L);
        when(contributionService.submit(eq(1L), eq(8L), any())).thenReturn(dto);
        when(contributions.findById(77L)).thenReturn(Optional.of(Contribution.builder().contributionId(77L).status("PENDING").build()));
        Map<String, Object> out = service.submit(1L, 8L, 3L, "QGH7XYZ123", null);
        assertEquals("SUBMITTED", out.get("status"));
        assertEquals(77L, i.getContributionId());
        verify(contributionService).submit(eq(1L), eq(8L), argThat(e -> "FINE".equals(e.type()) && e.amount().compareTo(new BigDecimal("50")) == 0));
    }

    @Test
    void anExpiredOrCancelledIntentCannotBeSubmitted() {
        awaiting(ZonedDateTime.now().minusMinutes(1));
        assertThrows(IllegalStateException.class, () -> service.submit(1L, 8L, 3L, "QGH7XYZ123", null));
        verifyNoInteractions(contributionService);
    }

    @Test
    void someoneElsesIntentIsNotFound() {
        awaiting(ZonedDateTime.now().plusHours(1));
        when(members.findByChamaChamaIdAndUserUserId(1L, 9L)).thenReturn(Optional.of(ChamaMember.builder().user(user(9)).role("MEMBER").isActive(true).build()));
        assertThrows(IllegalArgumentException.class, () -> service.cancel(1L, 9L, 3L));
    }

    @Test
    void confirmedAndFailedComeFromTheContribution() {
        PaymentIntent i = PaymentIntent.builder().status("SUBMITTED").build();
        assertEquals("CONFIRMED", PaymentIntentService.effectiveStatus(i, "COMPLETED"));
        assertEquals("FAILED", PaymentIntentService.effectiveStatus(i, "FAILED"));
        assertEquals("SUBMITTED", PaymentIntentService.effectiveStatus(i, "PENDING"));
        assertEquals("CANCELLED", PaymentIntentService.effectiveStatus(PaymentIntent.builder().status("CANCELLED").build(), "COMPLETED"));
    }
}
