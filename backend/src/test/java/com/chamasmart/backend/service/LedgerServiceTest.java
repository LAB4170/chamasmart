package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
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
class LedgerServiceTest {
    @Mock LedgerEntryRepository ledgerRepo;
    @Mock ChamaRepository chamaRepo;
    @Mock WelfareFundRepository welfareRepo;
    @Mock ChamaMemberRepository memberRepo;
    @InjectMocks LedgerService service;

    Chama chama;

    @BeforeEach
    void setUp() {
        chama = Chama.builder().chamaId(1L).currentFund(new BigDecimal("1500.00")).build();
        when(chamaRepo.findById(1L)).thenReturn(Optional.of(chama));
        when(welfareRepo.findByChamaChamaId(1L)).thenReturn(Optional.empty());
        when(ledgerRepo.balance(1L, LedgerEntry.CHAMA_FUND)).thenReturn(new BigDecimal("1500"));
        when(ledgerRepo.balance(1L, LedgerEntry.WELFARE_FUND)).thenReturn(BigDecimal.ZERO);
    }

    @Test void agreeingBalancesReconcile() {
        assertTrue(service.reconcile(1L).stream().allMatch(LedgerService.Line::ok));
    }

    @Test void aStoredBalanceThatDriftedIsReportedWithTheDifference() {
        chama.setCurrentFund(new BigDecimal("1700.00"));
        var line = service.reconcile(1L).get(0);
        assertFalse(line.ok());
        assertEquals(0, new BigDecimal("200").compareTo(line.difference()));
    }

    @Test void welfareFundIsReconciledToo() {
        when(welfareRepo.findByChamaChamaId(1L)).thenReturn(Optional.of(WelfareFund.builder().chama(chama).balance(new BigDecimal("50")).build()));
        assertFalse(service.reconcile(1L).get(1).ok());
    }

    @Test void zeroAmountsAreNotJournalled() {
        service.post(chama, LedgerEntry.CHAMA_FUND, BigDecimal.ZERO, "X", "X", 1L, 1L, "x");
        verify(ledgerRepo, never()).save(any());
    }

    @Test void postsKeepTheSign() {
        service.post(chama, LedgerEntry.CHAMA_FUND, new BigDecimal("-25.5"), "LOAN_DISBURSEMENT", "LOAN", 4L, 9L, "m");
        org.mockito.ArgumentCaptor<LedgerEntry> c = org.mockito.ArgumentCaptor.forClass(LedgerEntry.class);
        verify(ledgerRepo).save(c.capture());
        assertEquals(0, new BigDecimal("-25.50").compareTo(c.getValue().getAmount()));
    }

    @Test void onlyOfficialsSeeTheLedger() {
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 5L)).thenReturn(Optional.of(ChamaMember.builder().role("MEMBER").isActive(true).build()));
        assertThrows(AccessDeniedException.class, () -> service.report(1L, 5L));
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 7L)).thenReturn(Optional.of(ChamaMember.builder().role("TREASURER").isActive(true).build()));
        when(ledgerRepo.findTop100ByChamaChamaIdOrderByEntryIdDesc(1L)).thenReturn(List.of());
        assertEquals(true, service.report(1L, 7L).get("balanced"));
    }
}
