package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.RoscaCycleDto;
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
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RoscaServiceTest {
    @Mock RoscaCycleRepository cycleRepo;
    @Mock RoscaRosterRepository rosterRepo;
    @Mock ChamaRepository chamaRepo;
    @Mock ChamaMemberRepository memberRepo;
    @Mock UserRepository userRepo;
    @Mock ContributionRepository contribRepo;
    @Mock FinancialAuditLogRepository auditRepo;
    @Mock MembershipService membership;
    @Mock ContributionService contributions;
    @Mock LoanRepository loanRepo;

    RoscaService service;
    Chama chama;
    RoscaCycle cycle;

    private static User user(long id) { User u = new User(); u.setUserId(id); u.setFirstName("U" + id); u.setLastName("X"); return u; }
    private ChamaMember member(long id, String role) {
        ChamaMember m = ChamaMember.builder().chama(chama).user(user(id)).role(role).isActive(true).build();
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, id)).thenReturn(Optional.of(m));
        return m;
    }

    @BeforeEach
    void setUp() {
        chama = Chama.builder().chamaId(1L).chamaName("G").chamaType("ROSCA").isActive(true).currentFund(new BigDecimal("10000")).build();
        cycle = RoscaCycle.builder().cycleId(5L).chama(chama).cycleName("C1").totalMembers(3)
                .contributionAmount(new BigDecimal("1000")).status("ACTIVE").build();
        when(chamaRepo.findById(1L)).thenReturn(Optional.of(chama));
        when(chamaRepo.findByIdWithPessimisticLock(1L)).thenReturn(Optional.of(chama));
        when(cycleRepo.findById(5L)).thenReturn(Optional.of(cycle));
        when(cycleRepo.findByIdWithPessimisticLock(5L)).thenReturn(Optional.of(cycle));
        service = new RoscaService(cycleRepo, rosterRepo, chamaRepo, memberRepo, userRepo, contribRepo, auditRepo, membership, contributions, loanRepo);
    }

    private RoscaRoster roster(long id, long userId, int pos, String status) {
        return RoscaRoster.builder().rosterId(id).cycle(cycle).user(user(userId)).position(pos).status(status).build();
    }

    @Test void nonOfficialCannotCreateACycle() {
        when(membership.activeOfficial(1L, 9L)).thenThrow(new AccessDeniedException("no"));
        RoscaCycleDto dto = new RoscaCycleDto(); dto.setCycle_name("X");
        assertThrows(AccessDeniedException.class, () -> service.createCycle(dto, 1L, 9L));
        verify(cycleRepo, never()).save(any());
    }

    @Test void secondActiveCycleIsRefused() {
        when(cycleRepo.findByChamaChamaId(1L)).thenReturn(List.of(cycle));
        RoscaCycleDto dto = new RoscaCycleDto(); dto.setCycle_name("X");
        assertThrows(IllegalStateException.class, () -> service.createCycle(dto, 1L, 7L));
    }

    @Test void contributionGoesToVerificationNotStraightToTheFund() {
        service.makeContribution(1L, 5L, 4L, new BigDecimal("1000"));
        verify(contributions).submit(eq(1L), eq(4L), any());
        assertEquals(0, new BigDecimal("10000").compareTo(chama.getCurrentFund()));
    }

    @Test void contributionToAnotherChamasCycleIsRefused() {
        assertThrows(IllegalArgumentException.class, () -> service.makeContribution(2L, 5L, 4L, BigDecimal.TEN));
    }

    @Test void contributionToACancelledCycleIsRefused() {
        cycle.setStatus("CANCELLED");
        assertThrows(IllegalStateException.class, () -> service.makeContribution(1L, 5L, 4L, BigDecimal.TEN));
    }

    @Test void memberCannotTriggerAPayout() {
        member(4, "MEMBER");
        assertThrows(AccessDeniedException.class, () -> service.processPayout(5L, 4L));
        assertEquals(0, new BigDecimal("10000").compareTo(chama.getCurrentFund()));
    }

    @Test void officialCannotPayOutToThemselves() {
        member(7, "TREASURER"); member(8, "MEMBER");
        when(rosterRepo.findByCycleCycleIdOrderByPositionAsc(5L)).thenReturn(List.of(roster(1, 7, 1, "ACTIVE"), roster(2, 8, 2, "ACTIVE")));
        assertThrows(AccessDeniedException.class, () -> service.processPayout(5L, 7L));
        assertEquals(0, new BigDecimal("10000").compareTo(chama.getCurrentFund()));
    }

    @Test void payoutDeductsThePotAndMarksPaid() {
        member(7, "TREASURER"); member(8, "MEMBER"); member(9, "MEMBER");
        RoscaRoster r1 = roster(1, 8, 1, "ACTIVE");
        when(rosterRepo.findByCycleCycleIdOrderByPositionAsc(5L)).thenReturn(List.of(r1, roster(2, 9, 2, "ACTIVE")));
        service.processPayout(5L, 7L);
        assertEquals("PAID", r1.getStatus());
        assertEquals(0, new BigDecimal("7000").compareTo(chama.getCurrentFund()));
    }

    @Test void payoutIsRefusedWhenTheFundIsShort() {
        member(7, "TREASURER"); member(8, "MEMBER");
        chama.setCurrentFund(new BigDecimal("2000"));
        when(rosterRepo.findByCycleCycleIdOrderByPositionAsc(5L)).thenReturn(List.of(roster(1, 8, 1, "ACTIVE")));
        assertThrows(RuntimeException.class, () -> service.processPayout(5L, 7L));
        assertEquals("ACTIVE", cycle.getStatus());
    }

    @Test void payoutOnACancelledCycleIsRefused() {
        member(7, "TREASURER");
        cycle.setStatus("CANCELLED");
        assertThrows(IllegalStateException.class, () -> service.processPayout(5L, 7L));
    }

    @Test void cycleWithAPayoutCannotBeCancelled() {
        when(rosterRepo.findByCycleCycleIdOrderByPositionAsc(5L)).thenReturn(List.of(roster(1, 8, 1, "PAID")));
        assertThrows(IllegalStateException.class, () -> service.cancelCycle(5L, 7L));
        assertEquals("ACTIVE", cycle.getStatus());
    }

    @Test void unpaidCycleCanBeCancelledByAnOfficial() {
        when(rosterRepo.findByCycleCycleIdOrderByPositionAsc(5L)).thenReturn(List.of(roster(1, 8, 1, "ACTIVE")));
        service.cancelCycle(5L, 7L);
        assertEquals("CANCELLED", cycle.getStatus());
    }

    private void bigPot() { cycle.setContributionAmount(new BigDecimal("5000")); cycle.setTotalMembers(3); chama.setCurrentFund(new BigDecimal("40000")); } // pot 15,000

    @Test void largePotNeedsASecondOfficialToRelease() {
        ChamaMember t = member(7, "TREASURER"); ChamaMember c = member(6, "CHAIRPERSON"); member(8, "MEMBER");
        when(memberRepo.findByChamaChamaIdAndIsActiveTrue(1L)).thenReturn(List.of(t, c));
        bigPot();
        RoscaRoster r1 = roster(1, 8, 1, "ACTIVE");
        when(rosterRepo.findByCycleCycleIdOrderByPositionAsc(5L)).thenReturn(List.of(r1, roster(2, 9, 2, "ACTIVE")));
        assertEquals("AWAITING_SECOND_OFFICIAL", service.processPayout(5L, 7L));
        assertEquals("PAYOUT_PENDING", r1.getStatus());
        assertEquals(0, new BigDecimal("40000").compareTo(chama.getCurrentFund()));
        // the same official cannot release their own request
        assertThrows(AccessDeniedException.class, () -> service.processPayout(5L, 7L));
        assertEquals(0, new BigDecimal("40000").compareTo(chama.getCurrentFund()));
        // a different official releases it
        assertEquals("PAID", service.processPayout(5L, 6L));
        assertEquals("PAID", r1.getStatus());
        assertEquals(0, new BigDecimal("25000").compareTo(chama.getCurrentFund()));
    }

    @Test void smallPotStaysSingleStep() {
        member(7, "TREASURER"); member(8, "MEMBER");
        RoscaRoster r1 = roster(1, 8, 1, "ACTIVE");
        when(rosterRepo.findByCycleCycleIdOrderByPositionAsc(5L)).thenReturn(List.of(r1, roster(2, 9, 2, "ACTIVE")));
        assertEquals("PAID", service.processPayout(5L, 7L));
    }

    @Test void membersWhoLeftAreSkippedNotPaid() {
        member(7, "TREASURER"); member(9, "MEMBER");
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 8L)).thenReturn(Optional.of(ChamaMember.builder().role("MEMBER").isActive(false).build()));
        RoscaRoster gone = roster(1, 8, 1, "ACTIVE"); RoscaRoster next = roster(2, 9, 2, "ACTIVE");
        when(rosterRepo.findByCycleCycleIdOrderByPositionAsc(5L)).thenReturn(List.of(gone, next));
        service.processPayout(5L, 7L);
        assertEquals("SKIPPED", gone.getStatus());
        assertEquals("PAID", next.getStatus());
    }

    @Test void recipientWithADefaultedLoanIsNotPaid() {
        member(7, "TREASURER"); member(8, "MEMBER");
        Loan bad = new Loan(); bad.setStatus("DEFAULTED");
        when(loanRepo.findByBorrowerUserId(8L)).thenReturn(List.of(bad));
        when(rosterRepo.findByCycleCycleIdOrderByPositionAsc(5L)).thenReturn(List.of(roster(1, 8, 1, "ACTIVE")));
        assertThrows(IllegalStateException.class, () -> service.processPayout(5L, 7L));
        assertEquals(0, new BigDecimal("10000").compareTo(chama.getCurrentFund()));
    }

    @Test void withOnlyOneEligibleOfficialALargePotIsNotBlocked() {
        ChamaMember t = member(7, "TREASURER"); member(8, "MEMBER");
        when(memberRepo.findByChamaChamaIdAndIsActiveTrue(1L)).thenReturn(List.of(t));
        bigPot();
        when(rosterRepo.findByCycleCycleIdOrderByPositionAsc(5L)).thenReturn(List.of(roster(1, 8, 1, "ACTIVE")));
        assertEquals("PAID", service.processPayout(5L, 7L));
    }
}
