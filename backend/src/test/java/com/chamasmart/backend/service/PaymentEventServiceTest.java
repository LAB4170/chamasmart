package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.Chama;
import com.chamasmart.backend.domain.PaymentEvent;
import com.chamasmart.backend.domain.PaymentIntent;
import com.chamasmart.backend.dto.ContributionSummaryDto;
import com.chamasmart.backend.payments.PaystackProvider;
import com.chamasmart.backend.repository.ChamaRepository;
import com.chamasmart.backend.repository.PaymentEventRepository;
import com.chamasmart.backend.repository.PaymentIntentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.ZonedDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PaymentEventServiceTest {
    static final String KEY = "sk_test_unit";
    PaystackProvider paystack = new PaystackProvider();
    PaymentEventRepository events = mock(PaymentEventRepository.class);
    PaymentIntentRepository intents = mock(PaymentIntentRepository.class);
    ChamaRepository chamas = mock(ChamaRepository.class);
    ContributionService contributions = mock(ContributionService.class);
    TransactionTemplate tx = mock(TransactionTemplate.class);
    SubscriptionService subscriptions = mock(SubscriptionService.class);
    PaymentEventService service;
    PaymentEvent stored;
    PaymentIntent intent;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(paystack, "secretKey", KEY);
        ReflectionTestUtils.setField(paystack, "enabled", true);
        service = new PaymentEventService(paystack, events, intents, chamas, contributions, tx, subscriptions);
        doAnswer(i -> { @SuppressWarnings("unchecked") java.util.function.Consumer<Object> c = i.getArgument(0); c.accept(null); return null; }).when(tx).executeWithoutResult(any());
        when(events.saveAndFlush(any())).thenAnswer(i -> { stored = i.getArgument(0); ReflectionTestUtils.setField(stored, "eventId", 1L); return stored; });
        when(events.findById(1L)).thenAnswer(i -> Optional.of(stored));
        when(events.save(any())).thenAnswer(i -> i.getArgument(0));
        intent = PaymentIntent.builder().intentId(7L).chamaId(3L).userId(9L).purpose("CONTRIBUTION").amount(new BigDecimal("500.00")).provider("PAYSTACK")
                .status("AWAITING_PAYMENT").idempotencyKey("k").expiresAt(ZonedDateTime.now().plusHours(1)).build();
        when(intents.findById(7L)).thenReturn(Optional.of(intent));
        Chama c = Chama.builder().chamaId(3L).chamaName("Test").currency("KES").build();
        when(chamas.findById(3L)).thenReturn(Optional.of(c));
        ContributionSummaryDto dto = mock(ContributionSummaryDto.class);
        when(dto.getContribution_id()).thenReturn(55L);
        when(contributions.creditProviderPayment(anyLong(), anyLong(), any(), anyString())).thenReturn(dto);
    }

    static String sign(String body) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA512");
        mac.init(new SecretKeySpec(KEY.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
        StringBuilder sb = new StringBuilder();
        for (byte b : mac.doFinal(body.getBytes(StandardCharsets.UTF_8))) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    static String body(long id, long amountMinor, String currency, String ref) {
        return "{\"event\":\"charge.success\",\"data\":{\"id\":" + id + ",\"amount\":" + amountMinor + ",\"currency\":\"" + currency + "\",\"reference\":\"" + ref + "\",\"metadata\":{\"intent_id\":7}}}";
    }

    @Test
    void aBadSignatureIsRefusedAndNothingIsRecorded() throws Exception {
        assertEquals(PaymentEventService.Result.REJECTED, service.handlePaystack(body(1, 50000, "KES", "CS-7-AAAA"), "deadbeef"));
        assertEquals(PaymentEventService.Result.REJECTED, service.handlePaystack(body(1, 50000, "KES", "CS-7-AAAA"), null));
        verify(events, never()).saveAndFlush(any());
    }

    @Test
    void aSignedMatchingPaymentIsCreditedOnce() throws Exception {
        String b = body(1, 50000, "KES", "CS-7-AAAA");
        assertEquals(PaymentEventService.Result.ACCEPTED, service.handlePaystack(b, sign(b)));
        verify(contributions).creditProviderPayment(eq(3L), eq(9L), any(), eq("CS-7-AAAA"));
        assertEquals("CREDITED", stored.getStatus());
        assertEquals("SUBMITTED", intent.getStatus());
        assertEquals(55L, intent.getContributionId());
    }

    @Test
    void aRetriedWebhookDoesNothing() throws Exception {
        String b = body(1, 50000, "KES", "CS-7-AAAA");
        doThrow(new DataIntegrityViolationException("dup")).when(events).saveAndFlush(any());
        assertEquals(PaymentEventService.Result.DUPLICATE, service.handlePaystack(b, sign(b)));
        verify(contributions, never()).creditProviderPayment(anyLong(), anyLong(), any(), anyString());
    }

    @Test
    void wrongAmountWrongCurrencyOrAForeignReferenceIsParkedNotCredited() throws Exception {
        for (String b : new String[]{body(2, 49900, "KES", "CS-7-AAAA"), body(3, 50000, "USD", "CS-7-AAAA"), body(4, 50000, "KES", "XX-9-AAAA")}) {
            stored = null;
            assertEquals(PaymentEventService.Result.ACCEPTED, service.handlePaystack(b, sign(b)));
            assertEquals("UNMATCHED", stored.getStatus(), b);
        }
        verify(contributions, never()).creditProviderPayment(anyLong(), anyLong(), any(), anyString());
        assertEquals("AWAITING_PAYMENT", intent.getStatus());
    }

    @Test
    void anIntentThatIsNoLongerWaitingIsNotCreditedTwice() throws Exception {
        intent.setStatus("SUBMITTED");
        String b = body(5, 50000, "KES", "CS-7-BBBB");
        service.handlePaystack(b, sign(b));
        assertEquals("UNMATCHED", stored.getStatus());
        verify(contributions, never()).creditProviderPayment(anyLong(), anyLong(), any(), anyString());
    }

    @Test
    void amountsConvertToMinorUnits() {
        assertEquals(50000L, PaystackProvider.toMinor(new BigDecimal("500.00")));
        assertEquals(1999L, PaystackProvider.toMinor(new BigDecimal("19.99")));
    }
}
