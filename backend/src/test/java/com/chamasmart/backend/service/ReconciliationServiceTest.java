package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.Contribution;
import com.chamasmart.backend.domain.PaymentEvent;
import com.chamasmart.backend.repository.*;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ReconciliationServiceTest {
    static final String CSV = "Statement of account\nReceipt No.,Completion Time,Details,Paid In,Withdrawn,Balance\n"
            + "QAA1111111,2026-10-01,\"Pay Bill from 2547 - Joe, Mwangi\",\"1,000.00\",,5000\n"
            + "QAB2222222,2026-10-01,Pay Bill,500.00,,5500\n"
            + "QAC3333333,2026-10-02,Pay Bill,300.00,,5800\n"
            + "QAD4444444,2026-10-02,Pay Bill,200.00,,6000\n"
            + "QAE5555555,2026-10-02,Pay Bill,100.00,,6100\n"
            + "QAF6666666,2026-10-03,Payout,,400.00,5700\n";

    @Test
    void parsesQuotedCellsKeepsOnlyMoneyIn() {
        List<ReconciliationService.Line> l = ReconciliationService.parse(CSV);
        assertEquals(5, l.size());
        assertEquals(new BigDecimal("1000.00"), l.get(0).amount());
        assertEquals("QAA1111111", l.get(0).receipt());
    }

    @Test
    void classifiesEveryLine() {
        MembershipService membership = mock(MembershipService.class);
        ContributionRepository contribs = mock(ContributionRepository.class);
        PaymentEventRepository events = mock(PaymentEventRepository.class);
        ReconciliationRunRepository runs = mock(ReconciliationRunRepository.class);
        when(runs.save(any())).thenAnswer(i -> i.getArgument(0));
        Contribution ok = Contribution.builder().reference("MPEQAA1111111").amount(new BigDecimal("1000.00")).status("COMPLETED").build();
        Contribution wrong = Contribution.builder().reference("QAB2222222").amount(new BigDecimal("450.00")).status("COMPLETED").build();
        Contribution pend = Contribution.builder().reference("QAC3333333").amount(new BigDecimal("300.00")).status("PENDING").build();
        when(contribs.findByReferences(eq(3L), any())).thenReturn(List.of(ok, wrong, pend));
        PaymentEvent held = PaymentEvent.builder().chamaId(3L).status("UNMATCHED").provider("MPESA_C2B").providerEventId("QAD4444444").eventType("x").build();
        when(events.findByProviderAndProviderEventId("MPESA_C2B", "QAD4444444")).thenReturn(Optional.of(held));
        when(events.findByProviderAndProviderEventId("MPESA_C2B", "QAE5555555")).thenReturn(Optional.empty());

        Map<String, Object> r = new ReconciliationService(membership, contribs, events, runs).reconcile(3L, 1L, CSV);
        assertEquals(1, r.get("matched"));
        assertEquals(1, r.get("amount_differs"));
        assertEquals(1, r.get("pending"));
        assertEquals(1, r.get("held"));
        assertEquals(1, r.get("missing"));
        assertEquals(false, r.get("reconciled"));
        assertEquals(new BigDecimal("2100.00"), r.get("statement_total"));
    }

    @Test
    void aStatementWithoutPaymentsIsRefused() {
        var svc = new ReconciliationService(mock(MembershipService.class), mock(ContributionRepository.class), mock(PaymentEventRepository.class), mock(ReconciliationRunRepository.class));
        assertThrows(IllegalArgumentException.class, () -> svc.reconcile(3L, 1L, "nothing useful here"));
    }
}
