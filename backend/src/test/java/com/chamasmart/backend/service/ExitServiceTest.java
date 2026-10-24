package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.access.AccessDeniedException;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

class ExitServiceTest {
    MemberExitRepository exitRepo = mock(MemberExitRepository.class);
    ChamaRepository chamaRepo = mock(ChamaRepository.class);
    ChamaMemberRepository memberRepo = mock(ChamaMemberRepository.class);
    ContributionRepository contribRepo = mock(ContributionRepository.class);
    LoanRepository loanRepo = mock(LoanRepository.class);
    LoanGuarantorRepository guarRepo = mock(LoanGuarantorRepository.class);
    RoscaCycleRepository roscaRepo = mock(RoscaCycleRepository.class);
    AscaCycleRepository ascaRepo = mock(AscaCycleRepository.class);
    AscaMemberRepository ascaMemberRepo = mock(AscaMemberRepository.class);
    FinancialAuditLogRepository auditRepo = mock(FinancialAuditLogRepository.class);
    NotificationRepository notifRepo = mock(NotificationRepository.class);
    LedgerService ledger = mock(LedgerService.class);
    MembershipService membership = mock(MembershipService.class);
    UserRepository userRepo = mock(UserRepository.class);
    ExitService svc;
    Chama chama;
    User member, off1, off2;
    ChamaMember mm, o1, o2;
    final List<MemberExit> store = new ArrayList<>();
    final List<Contribution> contribs = new ArrayList<>();

    static User user(long id) { return User.builder().userId(id).firstName("U" + id).lastName("X").email(id + "@x.co").build(); }
    static ChamaMember cm(Chama c, User u, String role) { return ChamaMember.builder().chama(c).user(u).role(role).isActive(true).status("ACTIVE").build(); }

    @BeforeEach
    void setUp() {
        svc = new ExitService(exitRepo, chamaRepo, memberRepo, contribRepo, loanRepo, guarRepo, roscaRepo, ascaRepo, ascaMemberRepo, auditRepo, notifRepo, ledger, membership, userRepo);
        chama = Chama.builder().chamaId(1L).chamaName("Test").currentFund(new BigDecimal("50000")).build();
        member = user(10); off1 = user(11); off2 = user(12);
        mm = cm(chama, member, "MEMBER"); o1 = cm(chama, off1, "TREASURER"); o2 = cm(chama, off2, "CHAIRPERSON");
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 10L)).thenReturn(Optional.of(mm));
        when(memberRepo.findByChamaChamaIdAndIsActiveTrue(1L)).thenReturn(List.of(mm, o1, o2));
        when(chamaRepo.findById(1L)).thenReturn(Optional.of(chama));
        when(chamaRepo.findByIdWithPessimisticLock(1L)).thenReturn(Optional.of(chama));
        when(userRepo.getReferenceById(anyLong())).thenAnswer(i -> user(i.getArgument(0)));
        when(membership.activeMember(eq1(), anyLong())).thenReturn(mm);
        when(membership.activeOfficial(eq1(), anyLong())).thenReturn(o1);
        when(loanRepo.findByBorrowerUserId(anyLong())).thenReturn(List.of());
        when(guarRepo.findByGuarantorUserUserId(anyLong())).thenReturn(List.of());
        when(roscaRepo.findByChamaChamaId(1L)).thenReturn(List.of());
        when(ascaRepo.findByChamaChamaId(1L)).thenReturn(List.of());
        contribs.clear(); store.clear();
        contribs.add(Contribution.builder().chama(chama).user(member).amount(new BigDecimal("4000")).contributionType("REGULAR").status("COMPLETED").isDeleted(false).build());
        contribs.add(Contribution.builder().chama(chama).user(member).amount(new BigDecimal("500")).contributionType("WELFARE").status("COMPLETED").isDeleted(false).build());
        when(contribRepo.findByUserUserIdAndIsDeletedFalse(10L)).thenAnswer(i -> new ArrayList<>(contribs));
        when(contribRepo.save(any(Contribution.class))).thenAnswer(i -> { contribs.add(i.getArgument(0)); return i.getArgument(0); });
        when(exitRepo.save(any(MemberExit.class))).thenAnswer(i -> { MemberExit e = i.getArgument(0); if (e.getExitId() == null) e.setExitId(7L); if (!store.contains(e)) store.add(e); return e; });
        when(exitRepo.findById(7L)).thenAnswer(i -> store.stream().findFirst());
        when(exitRepo.findByChamaChamaIdAndUserUserIdAndStatusIn(anyLong(), anyLong(), any())).thenAnswer(i ->
                store.stream().filter(e -> ExitService.OPEN.contains(e.getStatus())).toList());
    }

    static Long eq1() { return org.mockito.ArgumentMatchers.eq(1L); }

    @Test
    void refundIsOnlyRegularSavings() {
        MemberExit e = svc.requestLeave(1L, 10L);
        assertEquals(0, new BigDecimal("4000").compareTo(e.getRefundAmount()));
        assertEquals("REQUESTED", e.getStatus());
    }

    @Test
    void openLoanBlocksLeaving() {
        Loan l = new Loan(); l.setChama(chama); l.setStatus("ACTIVE");
        when(loanRepo.findByBorrowerUserId(10L)).thenReturn(List.of(l));
        assertThrows(IllegalStateException.class, () -> svc.requestLeave(1L, 10L));
    }

    @Test
    void chairpersonCannotLeave() {
        mm.setRole("CHAIRPERSON");
        assertThrows(IllegalStateException.class, () -> svc.requestLeave(1L, 10L));
    }

    @Test
    void runningRoscaCycleBlocksLeaving() {
        RoscaCycle c = new RoscaCycle(); c.setStatus("ACTIVE");
        when(roscaRepo.findByChamaChamaId(1L)).thenReturn(List.of(c));
        assertThrows(IllegalStateException.class, () -> svc.requestLeave(1L, 10L));
    }

    @Test
    void memberCannotDecideOwnExit() {
        svc.requestLeave(1L, 10L);
        assertThrows(AccessDeniedException.class, () -> svc.approve(1L, 7L, 10L, true, null));
    }

    @Test
    void payNeedsApprovalFirst() {
        svc.requestLeave(1L, 10L);
        assertThrows(IllegalStateException.class, () -> svc.pay(1L, 7L, 12L, "QWE123"));
    }

    @Test
    void approverCannotAlsoPayWhenAnotherOfficialExists() {
        svc.requestLeave(1L, 10L);
        svc.approve(1L, 7L, 11L, true, null);
        assertThrows(AccessDeniedException.class, () -> svc.pay(1L, 7L, 11L, "QWE123"));
    }

    @Test
    void fullFlowPaysRefundAndRemovesMember() {
        svc.requestLeave(1L, 10L);
        svc.approve(1L, 7L, 11L, true, null);
        MemberExit done = svc.pay(1L, 7L, 12L, "QWE123");
        assertEquals("COMPLETED", done.getStatus());
        assertEquals(0, new BigDecimal("46000").compareTo(chama.getCurrentFund()));
        assertFalse(mm.getIsActive());
        verify(ledger).post(eq(chama), eq(LedgerEntry.CHAMA_FUND), eq(new BigDecimal("-4000.00")), any(), any(), any(), eq(12L), any());
        Map<String, Object> st = svc.statement(1L, 7L, 10L);
        assertEquals(0, new BigDecimal("4000").compareTo((BigDecimal) st.get("refund")));
    }

    @Test
    void refundIsRefusedWhenTheFundCannotCoverIt() {
        chama.setCurrentFund(new BigDecimal("1000"));
        svc.requestLeave(1L, 10L);
        svc.approve(1L, 7L, 11L, true, null);
        assertThrows(IllegalStateException.class, () -> svc.pay(1L, 7L, 12L, "QWE123"));
        assertTrue(mm.getIsActive());
    }

    @Test
    void refundNeedsAPaymentReference() {
        svc.requestLeave(1L, 10L);
        svc.approve(1L, 7L, 11L, true, null);
        assertThrows(IllegalArgumentException.class, () -> svc.pay(1L, 7L, 12L, " "));
    }

    @Test
    void decliningNeedsAReason() {
        svc.requestLeave(1L, 10L);
        assertThrows(IllegalArgumentException.class, () -> svc.approve(1L, 7L, 11L, false, ""));
    }

    @Test
    void onlyOneExitAtATime() {
        svc.requestLeave(1L, 10L);
        assertThrows(IllegalStateException.class, () -> svc.requestLeave(1L, 10L));
    }
}
