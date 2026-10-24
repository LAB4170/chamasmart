package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.MpesaCallbackDto;
import com.chamasmart.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MpesaServiceCallbackTest {

    @Mock MpesaTransactionRepository txRepo;
    @Mock ContributionRepository contributionRepo;
    @Mock ChamaRepository chamaRepo;
    @Mock UserRepository userRepo;
    @Mock ChamaMemberRepository memberRepo;
    @Mock FinancialAuditLogRepository auditRepo;
    @Mock org.springframework.context.ApplicationContext ctx;
    @Mock LedgerService ledger;
    @InjectMocks MpesaService service;

    Chama chama;
    MpesaTransaction tx;

    @BeforeEach
    void setUp() {
        chama = Chama.builder().chamaId(1L).currentFund(BigDecimal.ZERO).build();
        User user = new User();
        tx = MpesaTransaction.builder().checkoutRequestId("ws_CO_1").amount(new BigDecimal("500.00"))
                .phoneNumber("254700000000").chama(chama).user(user).status("PENDING").build();
        when(txRepo.findByCheckoutRequestIdForUpdate("ws_CO_1")).thenReturn(Optional.of(tx));
        when(contributionRepo.save(any(Contribution.class))).thenAnswer(i -> i.getArgument(0));
        when(memberRepo.findByChamaChamaIdAndUserUserId(any(), any())).thenReturn(Optional.empty());
    }

    private MpesaCallbackDto callback(int code, String receipt, String amount) {
        var items = new java.util.ArrayList<MpesaCallbackDto.Item>();
        if (receipt != null) items.add(MpesaCallbackDto.Item.builder().name("MpesaReceiptNumber").value(receipt).build());
        if (amount != null) items.add(MpesaCallbackDto.Item.builder().name("Amount").value(amount).build());
        var stk = MpesaCallbackDto.StkCallback.builder().checkoutRequestID("ws_CO_1").resultCode(code).resultDesc("x")
                .callbackMetadata(MpesaCallbackDto.CallbackMetadata.builder().item(items).build()).build();
        return MpesaCallbackDto.builder().body(MpesaCallbackDto.Body.builder().stkCallback(stk).build()).build();
    }

    @Test
    void successfulCallbackCreditsFundExactlyOnceEvenWhenReplayed() {
        service.processCallback(callback(0, "RCP123", "500"));
        service.processCallback(callback(0, "RCP123", "500")); // Daraja retry
        assertEquals("COMPLETED", tx.getStatus());
        assertEquals(0, new BigDecimal("500.00").compareTo(chama.getCurrentFund()));
        verify(contributionRepo, times(1)).save(any(Contribution.class));
    }

    @Test
    void amountMismatchIsRejectedAndNotCredited() {
        service.processCallback(callback(0, "RCP123", "1"));
        assertEquals("FAILED", tx.getStatus());
        assertEquals(0, BigDecimal.ZERO.compareTo(chama.getCurrentFund()));
        verify(contributionRepo, never()).save(any(Contribution.class));
    }

    @Test
    void missingReceiptIsRejectedAndNotCredited() {
        service.processCallback(callback(0, null, "500"));
        assertEquals("FAILED", tx.getStatus());
        verify(contributionRepo, never()).save(any(Contribution.class));
    }

    @Test
    void duplicateReceiptIsNotCreditedTwice() {
        when(contributionRepo.existsByReference("RCP123")).thenReturn(true);
        service.processCallback(callback(0, "RCP123", "500"));
        assertEquals("FAILED", tx.getStatus());
        verify(contributionRepo, never()).save(any(Contribution.class));
    }

    @Test
    void nonMemberCannotListChamaContributions() {
        when(memberRepo.existsByChamaChamaIdAndUserUserIdAndIsActiveTrue(1L, 99L)).thenReturn(false);
        assertThrows(AccessDeniedException.class, () -> service.getContributionsByChamaId(1L, 99L));
        verifyNoInteractions(contributionRepo);
    }

    private com.chamasmart.backend.dto.MpesaStkPushRequestDto req(String amount, String phone) {
        return com.chamasmart.backend.dto.MpesaStkPushRequestDto.builder().chamaId(1L).amount(amount == null ? null : new BigDecimal(amount)).phoneNumber(phone).build();
    }

    @Test
    void stkPushRejectsNonPositiveFractionalOrMissingAmount() {
        for (String bad : new String[] {null, "0", "-5", "10.50"}) {
            assertThrows(IllegalArgumentException.class, () -> service.initiateStkPush(req(bad, "0712345678"), 1L));
        }
    }

    @Test
    void stkPushRejectsInvalidPhone() {
        assertThrows(IllegalArgumentException.class, () -> service.initiateStkPush(req("100", "12345"), 1L));
    }

    @Test
    void transactionStatusIsOnlyVisibleToItsOwner() {
        User owner = new User(); owner.setUserId(7L);
        tx.setUser(owner);
        when(txRepo.findByCheckoutRequestId("ws_CO_1")).thenReturn(Optional.of(tx));
        assertThrows(AccessDeniedException.class, () -> service.getTransactionStatus("ws_CO_1", 8L));
        assertEquals("PENDING", service.getTransactionStatus("ws_CO_1", 7L).get("status"));
    }
}
