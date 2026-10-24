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
import com.chamasmart.backend.dto.AscaCycleDto;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AscaServiceTest {
    @Mock AscaCycleRepository cycleRepo;
    @Mock AscaMemberRepository memberRepo;
    @Mock ChamaRepository chamaRepo;
    @Mock UserRepository userRepo;
    @Mock ChamaMemberRepository chamaMemberRepo;
    @Mock FinancialAuditLogRepository auditRepo;
    @Mock LedgerService ledger;
    @Mock AscaShareRequestRepository requestRepo;
    @Mock LoanRepository loanRepo;
    @InjectMocks AscaService service;

    Chama chama;
    AscaCycle cycle;

    private static User user(long id) { User u = new User(); u.setUserId(id); u.setFirstName("U" + id); u.setLastName("X"); return u; }
    private void member(long id, String role) {
        when(chamaMemberRepo.findByChamaChamaIdAndUserUserId(1L, id)).thenReturn(Optional.of(ChamaMember.builder().role(role).isActive(true).build()));
        when(userRepo.findById(id)).thenReturn(Optional.of(user(id)));
    }

    @BeforeEach
    void setUp() {
        chama = Chama.builder().chamaId(1L).chamaName("G").chamaType("ASCA").currentFund(new BigDecimal("1000")).build();
        cycle = AscaCycle.builder().cycleId(3L).chama(chama).sharePrice(new BigDecimal("100")).totalShares(100).availableShares(100).status("ACTIVE").build();
        when(cycleRepo.findByIdWithPessimisticLock(3L)).thenReturn(Optional.of(cycle));
        when(chamaRepo.findByIdWithPessimisticLock(1L)).thenReturn(Optional.of(chama));
        when(cycleRepo.save(any(AscaCycle.class))).thenAnswer(i -> i.getArgument(0));
        when(memberRepo.save(any(AscaMember.class))).thenAnswer(i -> i.getArgument(0));
    }

    @Test void anOfficialCannotGiveThemselvesShares() {
        member(7, "TREASURER");
        assertThrows(AccessDeniedException.class, () -> service.purchaseShares(3L, 7L, 7L, 5));
        assertEquals(100, cycle.getAvailableShares());
        assertEquals(0, new BigDecimal("1000").compareTo(chama.getCurrentFund()));
    }

    @Test void anotherOfficialCanRecordSharesAndTheFundIsCredited() {
        member(7, "TREASURER"); member(8, "MEMBER");
        service.purchaseShares(3L, 7L, 8L, 5);
        assertEquals(95, cycle.getAvailableShares());
        assertEquals(0, new BigDecimal("1500").compareTo(chama.getCurrentFund()));
    }

    @Test void aPlainMemberCannotRecordShares() {
        member(8, "MEMBER");
        assertThrows(AccessDeniedException.class, () -> service.purchaseShares(3L, 8L, 8L, 5));
    }

    @Test void aLargePurchaseOnlyCreatesARequest() {
        member(7, "TREASURER"); member(8, "MEMBER");
        when(requestRepo.save(any(AscaShareRequest.class))).thenAnswer(i -> { AscaShareRequest r = i.getArgument(0); r.setRequestId(55L); return r; });
        var out = service.purchaseShares(3L, 7L, 8L, 100); // 100 x 100 = 10,000
        assertTrue(out.pending());
        assertEquals(100, cycle.getAvailableShares());
        assertEquals(0, new BigDecimal("1000").compareTo(chama.getCurrentFund()));
    }

    private AscaShareRequest request(String status) {
        return AscaShareRequest.builder().requestId(55L).cycle(cycle).user(user(8)).shares(100).amount(new BigDecimal("10000")).status(status).requestedBy(7L).build();
    }

    @Test void aDifferentOfficialVerifiesAndSharesAreIssued() {
        member(6, "CHAIRPERSON");
        when(requestRepo.findById(55L)).thenReturn(Optional.of(request("PENDING")));
        service.verifyShareRequest(55L, 6L);
        assertEquals(0, cycle.getAvailableShares());
        assertEquals(0, new BigDecimal("11000").compareTo(chama.getCurrentFund()));
    }

    @Test void theRequesterCannotVerifyTheirOwnRequest() {
        member(7, "TREASURER");
        when(requestRepo.findById(55L)).thenReturn(Optional.of(request("PENDING")));
        assertThrows(AccessDeniedException.class, () -> service.verifyShareRequest(55L, 7L));
        assertEquals(100, cycle.getAvailableShares());
    }

    @Test void theBuyerCannotVerifyTheirOwnShares() {
        member(8, "TREASURER");
        when(requestRepo.findById(55L)).thenReturn(Optional.of(request("PENDING")));
        assertThrows(AccessDeniedException.class, () -> service.verifyShareRequest(55L, 8L));
    }

    @Test void aRequestIsDecidedOnlyOnce() {
        member(6, "CHAIRPERSON");
        when(requestRepo.findById(55L)).thenReturn(Optional.of(request("VERIFIED")));
        assertThrows(IllegalStateException.class, () -> service.verifyShareRequest(55L, 6L));
    }

    private AscaMember holder(long user, int shares, String invested) {
        return AscaMember.builder().cycle(cycle).user(user(user)).sharesOwned(shares).totalInvestment(new BigDecimal(invested)).dividendsEarned(BigDecimal.ZERO).status("ACTIVE").build();
    }
    private void readyToClose() {
        member(7, "TREASURER"); member(6, "CHAIRPERSON");
        chama.setCurrentFund(new BigDecimal("1200"));
        when(cycleRepo.findById(3L)).thenReturn(Optional.of(cycle));
        when(chamaRepo.findById(1L)).thenReturn(Optional.of(chama));
        when(memberRepo.findByCycleCycleId(3L)).thenReturn(List.of(holder(8, 6, "600"), holder(9, 2, "200")));
        when(loanRepo.findByChamaChamaId(1L)).thenReturn(List.of());
        when(requestRepo.findByCycleId(3L)).thenReturn(List.of());
        when(chamaMemberRepo.findByChamaChamaIdAndIsActiveTrue(1L)).thenReturn(List.of(
                ChamaMember.builder().role("TREASURER").user(user(7)).isActive(true).build(), ChamaMember.builder().role("CHAIRPERSON").user(user(6)).isActive(true).build()));
    }

    @Test void shareOutSplitsTheCashByShares() {
        readyToClose();
        java.util.Map<String, Object> p = service.shareOutPreview(3L, 7L);
        assertEquals(true, p.get("can_close"));
        List<?> rows = (List<?>) p.get("members");
        assertEquals(0, new BigDecimal("900.00").compareTo((BigDecimal) ((java.util.Map<?, ?>) rows.get(0)).get("amount")));
        assertEquals(0, new BigDecimal("300.00").compareTo((BigDecimal) ((java.util.Map<?, ?>) rows.get(1)).get("amount")));
    }

    @Test void closingNeedsTwoOfficialsAndThenEmptiesTheFundIntoMembers() {
        readyToClose();
        assertEquals("AWAITING_SECOND_OFFICIAL", service.closeCycle(3L, 7L));
        assertEquals("CLOSING", cycle.getStatus());
        assertThrows(AccessDeniedException.class, () -> service.closeCycle(3L, 7L));
        assertEquals("CLOSED", service.closeCycle(3L, 6L));
        assertEquals("COMPLETED", cycle.getStatus());
        assertEquals(0, BigDecimal.ZERO.compareTo(chama.getCurrentFund()));
        verify(ledger).post(eq(chama), any(), eq(new BigDecimal("-1200.00")), eq("ASCA_SHARE_OUT"), any(), any(), eq(6L), any());
    }

    @Test void shareOutIsBlockedWhileLoansAreOpen() {
        readyToClose();
        Loan l = new Loan(); l.setStatus("ACTIVE");
        when(loanRepo.findByChamaChamaId(1L)).thenReturn(List.of(l));
        assertThrows(IllegalStateException.class, () -> service.closeCycle(3L, 7L));
        assertEquals("ACTIVE", cycle.getStatus());
    }

    @Test void aSecondRunningCycleIsRefused() {
        member(7, "TREASURER");
        when(chamaRepo.findById(1L)).thenReturn(Optional.of(chama));
        when(cycleRepo.findByChamaChamaId(1L)).thenReturn(List.of(cycle));
        AscaCycleDto dto = new AscaCycleDto(); dto.setCycle_name("Y2");
        assertThrows(IllegalStateException.class, () -> service.createCycle(dto, 1L, 7L));
    }

    @Test void newCyclesPromiseNoDividend() {
        member(7, "TREASURER");
        when(chamaRepo.findById(1L)).thenReturn(Optional.of(chama));
        when(cycleRepo.findByChamaChamaId(1L)).thenReturn(List.of());
        AscaCycleDto dto = new AscaCycleDto(); dto.setCycle_name("Y2"); dto.setDividend_rate(new BigDecimal("20"));
        service.createCycle(dto, 1L, 7L);
        org.mockito.ArgumentCaptor<AscaCycle> cap = org.mockito.ArgumentCaptor.forClass(AscaCycle.class);
        verify(cycleRepo).save(cap.capture());
        assertEquals(0, cap.getValue().getDividendRate().signum());
    }
}
