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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
    @Mock LedgerService ledger;
    @Mock RoscaSwapRepository swapRepo;
    @Mock NotificationRepository notifRepo;
    @Mock FineService fineSvc;

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
        collect(1000, 1000, 1000);
        service = new RoscaService(cycleRepo, rosterRepo, chamaRepo, memberRepo, userRepo, contribRepo, auditRepo, membership, contributions, loanRepo, ledger, swapRepo, notifRepo, fineSvc);
    }

    /** Verified merry-go-round payments linked to cycle 5, one per amount, from users 8, 9, 10... */
    private void collect(int... amounts) {
        List<Contribution> list = new ArrayList<>();
        for (int i = 0; i < amounts.length; i++) {
            list.add(Contribution.builder().contributionId(100L + i).chama(chama).user(user(8 + i)).amount(new BigDecimal(amounts[i]))
                    .contributionType("ROSCA").status("COMPLETED").cycleId(5L).isDeleted(false).build());
        }
        when(contribRepo.findByChamaChamaIdAndIsDeletedFalse(1L)).thenReturn(list);
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

    @Test void potIsNotPayableUntilTheRoundIsCollected() {
        member(7, "TREASURER"); member(8, "MEMBER"); member(9, "MEMBER");
        collect(1000, 1000);
        when(rosterRepo.findByCycleCycleIdOrderByPositionAsc(5L)).thenReturn(List.of(roster(1, 8, 1, "ACTIVE"), roster(2, 9, 2, "ACTIVE"), roster(3, 10, 3, "ACTIVE")));
        IllegalStateException e = assertThrows(IllegalStateException.class, () -> service.processPayout(5L, 7L));
        assertTrue(e.getMessage().contains("U10"));
        assertEquals(0, new BigDecimal("10000").compareTo(chama.getCurrentFund()));
    }

    @Test void moneyFromEarlierRoundsDoesNotPayThisOne() {
        member(7, "TREASURER"); member(9, "MEMBER");
        collect(1000, 1000, 1000);
        when(rosterRepo.findByCycleCycleIdOrderByPositionAsc(5L)).thenReturn(List.of(roster(1, 8, 1, "PAID"), roster(2, 9, 2, "ACTIVE")));
        assertThrows(IllegalStateException.class, () -> service.processPayout(5L, 7L));
    }

    @Test void roundStatusListsWhoIsBehind() {
        member(7, "TREASURER");
        collect(1000, 1000);
        when(rosterRepo.findByCycleCycleIdOrderByPositionAsc(5L)).thenReturn(List.of(roster(1, 8, 1, "ACTIVE"), roster(2, 9, 2, "ACTIVE"), roster(3, 10, 3, "ACTIVE")));
        Map<String, Object> r = service.getRound(5L, 7L);
        assertEquals(false, r.get("ready"));
        assertEquals(0, new BigDecimal("2000").compareTo((BigDecimal) r.get("available")));
        assertEquals("U10 X", r.get("behind_names"));
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

    private void bigPot() { cycle.setContributionAmount(new BigDecimal("5000")); cycle.setTotalMembers(3); chama.setCurrentFund(new BigDecimal("40000")); collect(5000, 5000, 5000); } // pot 15,000

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

    // ---- R-05 ordering and swaps, R-06 deadlines, R-07 joins ----

    private ChamaMember cm(long id, int joinedDaysAgo) {
        return ChamaMember.builder().chama(chama).user(user(id)).role("MEMBER").isActive(true).joinDate(java.time.ZonedDateTime.now().minusDays(joinedDaysAgo)).build();
    }

    @Test void rotationalOrderFollowsJoinDate() {
        RoscaCycleDto dto = new RoscaCycleDto();
        var ordered = service.orderMembers(List.of(cm(3, 5), cm(1, 90), cm(2, 30)), dto);
        assertEquals(List.of(1L, 2L, 3L), ordered.stream().map(m -> m.getUser().getUserId()).toList());
    }

    @Test void manualOrderIsUsedExactly() {
        RoscaCycleDto dto = new RoscaCycleDto(); dto.setPayout_order("MANUAL"); dto.setMember_order(List.of(3L, 1L, 2L));
        var ordered = service.orderMembers(List.of(cm(1, 90), cm(2, 30), cm(3, 5)), dto);
        assertEquals(List.of(3L, 1L, 2L), ordered.stream().map(m -> m.getUser().getUserId()).toList());
    }

    @Test void manualOrderMustCoverEveryoneOnce() {
        RoscaCycleDto dto = new RoscaCycleDto(); dto.setPayout_order("MANUAL"); dto.setMember_order(List.of(3L, 3L, 2L));
        assertThrows(IllegalArgumentException.class, () -> service.orderMembers(List.of(cm(1, 90), cm(2, 30), cm(3, 5)), dto));
        dto.setMember_order(List.of(1L, 2L));
        assertThrows(IllegalArgumentException.class, () -> service.orderMembers(List.of(cm(1, 90), cm(2, 30), cm(3, 5)), dto));
    }

    @Test void randomOrderKeepsEveryMemberExactlyOnce() {
        RoscaCycleDto dto = new RoscaCycleDto(); dto.setPayout_order("random");
        var ordered = service.orderMembers(List.of(cm(1, 90), cm(2, 30), cm(3, 5), cm(4, 1)), dto);
        assertEquals(java.util.Set.of(1L, 2L, 3L, 4L), ordered.stream().map(m -> m.getUser().getUserId()).collect(java.util.stream.Collectors.toSet()));
    }

    @Test void unknownOrderModeIsRefused() {
        RoscaCycleDto dto = new RoscaCycleDto(); dto.setPayout_order("BID");
        assertThrows(IllegalArgumentException.class, () -> service.orderMembers(List.of(cm(1, 1)), dto));
    }

    private void twoSlots(String sa, String sb) {
        RoscaRoster a = roster(1, 8, 1, sa); a.setPayoutDate(java.time.LocalDate.of(2026, 1, 1));
        RoscaRoster b = roster(2, 9, 2, sb); b.setPayoutDate(java.time.LocalDate.of(2026, 2, 1));
        when(rosterRepo.findByCycleCycleIdAndUserUserId(5L, 8L)).thenReturn(Optional.of(a));
        when(rosterRepo.findByCycleCycleIdAndUserUserId(5L, 9L)).thenReturn(Optional.of(b));
        doAnswer(i -> { RoscaSwap s = i.getArgument(0); s.setSwapId(77L); return s; }).when(swapRepo).save(any(RoscaSwap.class));
        doAnswer(i -> user(i.getArgument(0))).when(userRepo).getReferenceById(any());
    }

    @Test void swapIsRequestedButNothingMovesUntilAccepted() {
        twoSlots("ACTIVE", "ACTIVE");
        RoscaSwap s = service.requestSwap(5L, 8L, 9L, "school fees");
        assertEquals("PENDING", s.getStatus());
        assertEquals(1, rosterRepo.findByCycleCycleIdAndUserUserId(5L, 8L).get().getPosition());
    }

    @Test void acceptingSwapsPositionsAndDates() {
        twoSlots("ACTIVE", "ACTIVE");
        RoscaSwap s = RoscaSwap.builder().swapId(77L).cycle(cycle).requester(user(8)).target(user(9)).status("PENDING").build();
        when(swapRepo.findById(77L)).thenReturn(Optional.of(s));
        service.respondToSwap(77L, 9L, true);
        assertEquals(2, rosterRepo.findByCycleCycleIdAndUserUserId(5L, 8L).get().getPosition());
        assertEquals(1, rosterRepo.findByCycleCycleIdAndUserUserId(5L, 9L).get().getPosition());
        assertEquals(java.time.LocalDate.of(2026, 2, 1), rosterRepo.findByCycleCycleIdAndUserUserId(5L, 8L).get().getPayoutDate());
        assertEquals("ACCEPTED", s.getStatus());
    }

    @Test void onlyTheMemberAskedCanAnswer() {
        twoSlots("ACTIVE", "ACTIVE");
        RoscaSwap s = RoscaSwap.builder().swapId(77L).cycle(cycle).requester(user(8)).target(user(9)).status("PENDING").build();
        when(swapRepo.findById(77L)).thenReturn(Optional.of(s));
        assertThrows(AccessDeniedException.class, () -> service.respondToSwap(77L, 8L, true));
        assertThrows(AccessDeniedException.class, () -> service.respondToSwap(77L, 10L, true));
    }

    @Test void decliningLeavesTheOrderAlone() {
        twoSlots("ACTIVE", "ACTIVE");
        RoscaSwap s = RoscaSwap.builder().swapId(77L).cycle(cycle).requester(user(8)).target(user(9)).status("PENDING").build();
        when(swapRepo.findById(77L)).thenReturn(Optional.of(s));
        service.respondToSwap(77L, 9L, false);
        assertEquals(1, rosterRepo.findByCycleCycleIdAndUserUserId(5L, 8L).get().getPosition());
        assertEquals("DECLINED", s.getStatus());
    }

    @Test void paidTurnsCannotBeSwapped() {
        twoSlots("PAID", "ACTIVE");
        assertThrows(IllegalStateException.class, () -> service.requestSwap(5L, 8L, 9L, null));
        twoSlots("ACTIVE", "PAID");
        assertThrows(IllegalStateException.class, () -> service.requestSwap(5L, 8L, 9L, null));
    }

    @Test void cannotSwapWithYourself() {
        twoSlots("ACTIVE", "ACTIVE");
        assertThrows(IllegalArgumentException.class, () -> service.requestSwap(5L, 8L, 8L, null));
    }

    @Test void roundShowsOverdueDaysAndWhoIsWaitingForTheNextCycle() {
        RoscaRoster a = roster(1, 8, 1, "ACTIVE"); a.setPayoutDate(java.time.LocalDate.now().minusDays(4));
        when(rosterRepo.findByCycleCycleIdOrderByPositionAsc(5L)).thenReturn(List.of(a));
        when(memberRepo.findByChamaChamaIdAndIsActiveTrue(1L)).thenReturn(List.of(cm(8, 100), cm(20, 2)));
        when(membership.activeMember(1L, 8L)).thenReturn(cm(8, 100));
        Map<String, Object> round = service.getRound(5L, 8L);
        assertEquals(4L, round.get("days_overdue"));
        assertEquals(List.of("U20 X"), round.get("waiting_for_next_cycle"));
    }

    private Map<String, Object> roundWith(long behindUser, long paidUser) {
        Map<String, Object> a = new java.util.LinkedHashMap<>(); a.put("user_id", behindUser); a.put("arrears", new BigDecimal("1000"));
        Map<String, Object> b = new java.util.LinkedHashMap<>(); b.put("user_id", paidUser); b.put("arrears", BigDecimal.ZERO);
        Map<String, Object> r = new java.util.LinkedHashMap<>(); r.put("round_number", 2L); r.put("members", List.of(a, b));
        return r;
    }

    @Test
    void lateFeeIsChargedOnlyToMembersBehindAndOnlyAfterGrace() {
        cycle.setLateFee(new BigDecimal("100")); cycle.setGraceDays(3);
        when(userRepo.getReferenceById(8L)).thenReturn(user(8));
        when(fineSvc.issueLateRoundFine(any(), any(), eq(2), any(), any())).thenReturn(true);
        assertEquals(0, service.fineLateMembers(cycle, roundWith(8, 9), 3));
        assertEquals(1, service.fineLateMembers(cycle, roundWith(8, 9), 4));
        verify(fineSvc, times(1)).issueLateRoundFine(any(), any(), eq(2), argThat(u -> u.getUserId() == 8L), eq(new BigDecimal("100")));
        verify(fineSvc, never()).issueLateRoundFine(any(), any(), anyInt(), argThat(u -> u.getUserId() == 9L), any());
    }

    @Test
    void noLateFeeMeansNoFines() {
        cycle.setLateFee(null);
        assertEquals(0, service.fineLateMembers(cycle, roundWith(8, 9), 30));
        verifyNoInteractions(fineSvc);
    }

    @Test
    void lateFeeCannotExceedOneRoundOrGoNegative() {
        RoscaCycleDto dto = new RoscaCycleDto(); dto.setContribution_amount(new BigDecimal("1000"));
        dto.setLate_fee(new BigDecimal("1500"));
        assertThrows(IllegalArgumentException.class, () -> service.checkedLateFee(dto));
        dto.setLate_fee(new BigDecimal("-1"));
        assertThrows(IllegalArgumentException.class, () -> service.checkedLateFee(dto));
        dto.setLate_fee(new BigDecimal("200")); dto.setGrace_days(31);
        assertThrows(IllegalArgumentException.class, () -> service.checkedLateFee(dto));
        dto.setGrace_days(2);
        assertEquals(new BigDecimal("200.00"), service.checkedLateFee(dto));
    }
}
