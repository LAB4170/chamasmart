package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.ContributionSummaryDto;
import com.chamasmart.backend.ledger.AccountNumbers;
import com.chamasmart.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class C2bServiceTest {
    PaymentEventRepository events = mock(PaymentEventRepository.class);
    AccountNumberService accounts = mock(AccountNumberService.class);
    ChamaAccountCodeRepository codes = mock(ChamaAccountCodeRepository.class);
    ChamaRepository chamas = mock(ChamaRepository.class);
    ContributionService contributions = mock(ContributionService.class);
    ContributionRepository contributionRepo = mock(ContributionRepository.class);
    TransactionTemplate tx = mock(TransactionTemplate.class);
    C2bService service;
    PaymentEvent stored;
    String acctNo = AccountNumbers.memberAccount(AccountNumbers.chamaCode(20202), 1);

    @BeforeEach
    void setUp() {
        service = new C2bService(events, accounts, codes, chamas, contributions, contributionRepo, tx);
        ReflectionTestUtils.setField(service, "pooledShortcode", "400400");
        doAnswer(i -> { @SuppressWarnings("unchecked") java.util.function.Consumer<Object> c = i.getArgument(0); c.accept(null); return null; }).when(tx).executeWithoutResult(any());
        when(events.saveAndFlush(any())).thenAnswer(i -> { stored = i.getArgument(0); ReflectionTestUtils.setField(stored, "eventId", 1L); return stored; });
        when(events.findById(1L)).thenAnswer(i -> Optional.of(stored));
        when(events.save(any())).thenAnswer(i -> i.getArgument(0));
        when(accounts.lookup(acctNo)).thenReturn(Optional.of(MemberAccount.builder().accountNumber(acctNo).chamaId(3L).userId(9L).seq(1).build()));
        when(codes.findById(3L)).thenReturn(Optional.of(ChamaAccountCode.builder().chamaId(3L).accountCode("202022").channel("OWN_PAYBILL").shortcode("123456").build()));
        when(chamas.findById(3L)).thenReturn(Optional.of(Chama.builder().chamaId(3L).chamaName("T").currency("KES").build()));
        ContributionSummaryDto dto = mock(ContributionSummaryDto.class);
        when(dto.getContribution_id()).thenReturn(77L);
        when(contributions.creditProviderPayment(anyLong(), anyLong(), any(), anyString())).thenReturn(dto);
    }

    Map<String, Object> pay(String id, String shortcode, String account, String amount) {
        return Map.of("TransID", id, "BusinessShortCode", shortcode, "BillRefNumber", account, "TransAmount", amount, "MSISDN", "2547XXXXXXXX");
    }

    @Test
    void aPaymentToAKnownAccountOnTheRightShortcodeIsCreditedOnce() {
        service.confirm(pay("QWE1", "123456", acctNo, "500.00"));
        assertEquals("CREDITED", stored.getStatus());
        verify(contributions).creditProviderPayment(eq(3L), eq(9L), any(), eq("MPEQWE1"));
    }

    @Test
    void aRepeatedConfirmationIsIgnored() {
        doThrow(new DataIntegrityViolationException("dup")).when(events).saveAndFlush(any());
        service.confirm(pay("QWE1", "123456", acctNo, "500.00"));
        verify(contributions, never()).creditProviderPayment(anyLong(), anyLong(), any(), anyString());
    }

    @Test
    void anUnknownOrMistypedAccountIsParkedAndShownToTheChamaThatOwnsTheShortcode() {
        when(codes.findFirstByShortcode("123456")).thenReturn(Optional.of(ChamaAccountCode.builder().chamaId(3L).accountCode("x").build()));
        service.confirm(pay("QWE2", "123456", "12345", "500"));
        assertEquals("UNMATCHED", stored.getStatus());
        assertEquals(3L, stored.getChamaId());
        verify(contributions, never()).creditProviderPayment(anyLong(), anyLong(), any(), anyString());
    }

    @Test
    void paymentToTheWrongShortcodeOrAnAlreadyRecordedCodeIsParked() {
        service.confirm(pay("QWE3", "999999", acctNo, "500"));
        assertEquals("UNMATCHED", stored.getStatus());
        when(contributionRepo.existsByReferenceIgnoreCase("MPEQWE4")).thenReturn(true);
        service.confirm(pay("QWE4", "123456", acctNo, "500"));
        assertEquals("UNMATCHED", stored.getStatus());
        verify(contributions, never()).creditProviderPayment(anyLong(), anyLong(), any(), anyString());
    }

    @Test
    void aBadAmountIsParked() {
        service.confirm(pay("QWE5", "123456", acctNo, "abc"));
        assertEquals("UNMATCHED", stored.getStatus());
        service.confirm(pay("QWE6", "123456", acctNo, "0"));
        assertEquals("UNMATCHED", stored.getStatus());
    }

    @Test
    void validationAcceptsOnlyKnownAccounts() {
        assertTrue(service.accepts(Map.of("BillRefNumber", acctNo)));
        assertFalse(service.accepts(Map.of("BillRefNumber", "000")));
    }
}
