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
class ContributionServiceTest {
    @Mock ContributionRepository contribRepo;
    @Mock ChamaRepository chamaRepo;
    @Mock UserRepository userRepo;
    @Mock ChamaMemberRepository memberRepo;
    @Mock FinancialAuditLogRepository auditRepo;
    @Mock WelfareFundRepository welfareRepo;
    @Mock LedgerService ledger;
    @Mock RoscaCycleRepository cycleRepo;
    @Mock RoscaRosterRepository rosterRepo;
    @InjectMocks ContributionService service;

    Chama chama;

    private static User user(long id) { User u = new User(); u.setUserId(id); u.setFirstName("U" + id); u.setLastName("X"); return u; }
    private void member(long id, String role, boolean active) {
        ChamaMember m = ChamaMember.builder().role(role).isActive(active).totalContributions(BigDecimal.ZERO).build();
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, id)).thenReturn(Optional.of(m));
    }

    @BeforeEach
    void setUp() {
        chama = Chama.builder().chamaId(1L).chamaName("G").currentFund(new BigDecimal("1000")).build();
        when(chamaRepo.findById(1L)).thenReturn(Optional.of(chama));
        when(chamaRepo.findByIdWithPessimisticLock(1L)).thenReturn(Optional.of(chama));
        for (long i : new long[]{5, 6, 7}) when(userRepo.findById(i)).thenReturn(Optional.of(user(i)));
        when(contribRepo.save(any(Contribution.class))).thenAnswer(i -> i.getArgument(0));
    }

    private ContributionService.Entry entry(long user, String amount, String ref) {
        return new ContributionService.Entry(user, new BigDecimal(amount), ref, "REGULAR", null, null);
    }

    @Test void ordinaryMemberCannotRecordContributions() {
        member(5, "MEMBER", true);
        assertThrows(AccessDeniedException.class, () -> service.record(1L, 5L, entry(5, "100", null), true));
        assertEquals(new BigDecimal("1000"), chama.getCurrentFund());
    }

    private ContributionService.Entry roscaEntry(long user, String notes) {
        return new ContributionService.Entry(user, new BigDecimal("100"), null, "ROSCA", notes, null);
    }

    @Test void roscaPaymentIsLinkedToTheCycleByTheServer() {
        member(5, "MEMBER", true);
        RoscaCycle cycle = RoscaCycle.builder().cycleId(9L).chama(chama).status("ACTIVE").build();
        when(cycleRepo.findById(9L)).thenReturn(Optional.of(cycle));
        RoscaRoster r = RoscaRoster.builder().cycle(cycle).user(user(5)).status("ACTIVE").build();
        when(rosterRepo.findByCycleCycleIdOrderByPositionAsc(9L)).thenReturn(List.of(r));
        service.submit(1L, 5L, roscaEntry(5, "[cycle:9] C1"));
        org.mockito.ArgumentCaptor<Contribution> cap = org.mockito.ArgumentCaptor.forClass(Contribution.class);
        verify(contribRepo).save(cap.capture());
        assertEquals(9L, cap.getValue().getCycleId());
    }

    @Test void roscaPaymentCannotPointAtAnotherChamasCycleOrAnOffRosterMember() {
        member(5, "MEMBER", true);
        Chama other = Chama.builder().chamaId(2L).chamaName("Other").build();
        RoscaCycle foreign = RoscaCycle.builder().cycleId(8L).chama(other).status("ACTIVE").build();
        when(cycleRepo.findById(8L)).thenReturn(Optional.of(foreign));
        assertThrows(IllegalArgumentException.class, () -> service.submit(1L, 5L, roscaEntry(5, "[cycle:8] spoof")));
        RoscaCycle mine = RoscaCycle.builder().cycleId(9L).chama(chama).status("ACTIVE").build();
        when(cycleRepo.findById(9L)).thenReturn(Optional.of(mine));
        when(rosterRepo.findByCycleCycleIdOrderByPositionAsc(9L)).thenReturn(List.of());
        assertThrows(IllegalArgumentException.class, () -> service.submit(1L, 5L, roscaEntry(5, "[cycle:9] C1")));
        verify(contribRepo, never()).save(any());
    }

    @Test void outsiderCannotSubmitOrList() {
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 9L)).thenReturn(Optional.empty());
        assertThrows(AccessDeniedException.class, () -> service.submit(1L, 9L, entry(9, "100", null)));
        assertThrows(AccessDeniedException.class, () -> service.list(1L, 9L, null, null));
    }

    @Test void officialRecordCreditsTheFundOnce() {
        member(7, "TREASURER", true); member(6, "MEMBER", true);
        service.record(1L, 7L, entry(6, "250", "RCP1"), true);
        assertEquals(0, new BigDecimal("1250").compareTo(chama.getCurrentFund()));
        verify(ledger, times(1)).post(eq(chama), eq(LedgerEntry.CHAMA_FUND), argThat(a -> a.compareTo(new BigDecimal("250")) == 0), eq("CONTRIBUTION"), any(), any(), eq(7L), any());
        verify(auditRepo, times(1)).save(any());
    }

    @Test void amountsMustBePositive() {
        member(7, "TREASURER", true); member(6, "MEMBER", true);
        assertThrows(IllegalArgumentException.class, () -> service.record(1L, 7L, entry(6, "0", null), true));
        assertThrows(IllegalArgumentException.class, () -> service.record(1L, 7L, entry(6, "-5", null), true));
        assertEquals(new BigDecimal("1000"), chama.getCurrentFund());
    }

    @Test void duplicateReceiptReferenceIsRejected() {
        member(7, "TREASURER", true); member(6, "MEMBER", true);
        when(contribRepo.existsByReferenceIgnoreCase("RCP1")).thenReturn(true);
        assertThrows(IllegalArgumentException.class, () -> service.record(1L, 7L, entry(6, "100", "RCP1"), true));
    }

    @Test void memberSubmissionCreditsNothingUntilVerified() {
        member(5, "MEMBER", true);
        var dto = service.submit(1L, 5L, entry(5, "300", "M1"));
        assertEquals("PENDING", dto.getStatus());
        assertEquals(new BigDecimal("1000"), chama.getCurrentFund());
    }

    @Test void bulkIsAllOrNothingOnBadLine() {
        member(7, "TREASURER", true); member(6, "MEMBER", true);
        assertThrows(IllegalArgumentException.class, () -> service.bulkRecord(1L, 7L, List.of(entry(6, "100", null), entry(6, "-1", null))));
        // first line was processed in-memory before the failure; the transaction rolls back in production.
        verify(contribRepo, atMost(1)).save(any());
    }

    @Test void bulkRejectsDuplicateReferencesInOneBatch() {
        member(7, "TREASURER", true); member(6, "MEMBER", true);
        assertThrows(IllegalArgumentException.class, () -> service.bulkRecord(1L, 7L, List.of(entry(6, "100", "A"), entry(6, "100", "A"))));
    }

    private Contribution pending(long id, long owner) {
        Contribution c = Contribution.builder().contributionId(id).chama(chama).user(user(owner)).amount(new BigDecimal("400")).status("PENDING").contributionType("REGULAR").reference("P" + id).isDeleted(false).build();
        when(contribRepo.findById(id)).thenReturn(Optional.of(c));
        when(contribRepo.findByIdWithPessimisticLock(id)).thenReturn(Optional.of(c));
        return c;
    }

    @Test void verifyCreditsOnceAndCannotBeRepeated() {
        member(7, "TREASURER", true); member(5, "MEMBER", true);
        Contribution c = pending(30, 5);
        service.verify(1L, 7L, 30L, true);
        assertEquals("COMPLETED", c.getStatus());
        assertEquals(0, new BigDecimal("1400").compareTo(chama.getCurrentFund()));
        assertThrows(IllegalStateException.class, () -> service.verify(1L, 7L, 30L, true));
        assertEquals(0, new BigDecimal("1400").compareTo(chama.getCurrentFund()));
    }

    @Test void officialCannotVerifyTheirOwnSubmission() {
        member(7, "TREASURER", true);
        pending(31, 7);
        assertThrows(AccessDeniedException.class, () -> service.verify(1L, 7L, 31L, true));
    }

    @Test void memberCannotVerifyOrDelete() {
        member(5, "MEMBER", true);
        pending(32, 6);
        assertThrows(AccessDeniedException.class, () -> service.verify(1L, 5L, 32L, true));
        assertThrows(AccessDeniedException.class, () -> service.delete(1L, 5L, 32L, "x"));
    }

    @Test void membersSeeCompletedAndOwnButNotOthersPending() {
        member(5, "MEMBER", true);
        Contribution done = Contribution.builder().contributionId(1L).chama(chama).user(user(6)).amount(BigDecimal.TEN).status("COMPLETED").build();
        Contribution theirsPending = Contribution.builder().contributionId(2L).chama(chama).user(user(6)).amount(BigDecimal.TEN).status("PENDING").build();
        Contribution minePending = Contribution.builder().contributionId(3L).chama(chama).user(user(5)).amount(BigDecimal.TEN).status("PENDING").build();
        when(contribRepo.findByChamaChamaIdAndIsDeletedFalse(1L)).thenReturn(List.of(done, theirsPending, minePending));
        var out = service.list(1L, 5L, null, null);
        assertEquals(List.of(1L, 3L), out.stream().map(d -> d.getContribution_id()).toList());
    }

    @Test void anOfficialsOwnPaymentWaitsForASecondOfficial() {
        member(7, "TREASURER", true);
        var dto = service.record(1L, 7L, entry(7, "250", "SELF1"), true);
        assertEquals("PENDING", dto.getStatus());
        assertEquals(0, new BigDecimal("1000").compareTo(chama.getCurrentFund()));
        verify(auditRepo, never()).save(any());
    }

    @Test void largeAmountsNeedASecondOfficial() {
        member(7, "TREASURER", true); member(6, "MEMBER", true);
        var dto = service.record(1L, 7L, entry(6, "10000", "BIG1"), true);
        assertEquals("PENDING", dto.getStatus());
        assertEquals(0, new BigDecimal("1000").compareTo(chama.getCurrentFund()));
        var small = service.record(1L, 7L, entry(6, "9999.99", "SMALL1"), true);
        assertEquals("COMPLETED", small.getStatus());
    }

    @Test void bulkHoldsBackOwnAndLargeLinesButCreditsTheRest() {
        member(7, "TREASURER", true); member(6, "MEMBER", true);
        var out = service.bulkRecord(1L, 7L, List.of(entry(6, "100", "B1"), entry(7, "100", "B2"), entry(6, "20000", "B3")));
        assertEquals(List.of("COMPLETED", "PENDING", "PENDING"), out.stream().map(x -> x.getStatus()).toList());
        assertEquals(0, new BigDecimal("1100").compareTo(chama.getCurrentFund()));
    }

    @Test void whoeverKeyedInAPaymentCannotVerifyIt() {
        member(7, "TREASURER", true);
        Contribution c = pending(40, 6);
        c.setRecordedBy(7L);
        assertThrows(AccessDeniedException.class, () -> service.verify(1L, 7L, 40L, true));
        assertEquals(0, new BigDecimal("1000").compareTo(chama.getCurrentFund()));
    }

    private Contribution completed(long id, long owner) {
        Contribution c = pending(id, owner);
        c.setStatus("COMPLETED");
        return c;
    }

    @Test void reversalNeedsAReason() {
        member(7, "TREASURER", true); member(6, "MEMBER", true);
        completed(50, 6);
        assertThrows(IllegalArgumentException.class, () -> service.delete(1L, 7L, 50L, " "));
        assertThrows(IllegalArgumentException.class, () -> service.delete(1L, 7L, 50L, null));
    }

    @Test void anOfficialCannotReverseTheirOwnContribution() {
        member(7, "TREASURER", true);
        completed(51, 7);
        assertThrows(AccessDeniedException.class, () -> service.delete(1L, 7L, 51L, "oops"));
    }

    @Test void reversalWithReasonRemovesTheCreditAndKeepsTheReason() {
        member(7, "TREASURER", true); member(6, "MEMBER", true);
        Contribution c = completed(52, 6);
        service.delete(1L, 7L, 52L, "Duplicate entry");
        assertEquals(0, new BigDecimal("600").compareTo(chama.getCurrentFund()));
        assertEquals("Duplicate entry", c.getDeletedReason());
        assertTrue(c.getIsDeleted());
    }

    @Test void reversalIsBlockedWhenTheFundHasAlreadyBeenSpent() {
        member(7, "TREASURER", true); member(6, "MEMBER", true);
        completed(60, 6);
        chama.setCurrentFund(new BigDecimal("100")); // money was lent out; the contribution was 400
        assertThrows(IllegalStateException.class, () -> service.delete(1L, 7L, 60L, "mistake"));
        assertEquals(0, new BigDecimal("100").compareTo(chama.getCurrentFund()));
    }

    @Test void aReversalIsJournalledAsANegativeEntry() {
        member(7, "TREASURER", true); member(6, "MEMBER", true);
        completed(70, 6);
        service.delete(1L, 7L, 70L, "duplicate");
        verify(ledger).post(eq(chama), eq(LedgerEntry.CHAMA_FUND), argThat(a -> a.compareTo(new BigDecimal("-400")) == 0), eq("REVERSAL"), any(), any(), eq(7L), any());
    }

    @Test void aHeldPaymentWritesNothingToTheJournal() {
        member(7, "TREASURER", true);
        service.record(1L, 7L, entry(7, "250", "SELF2"), true);
        verify(ledger, never()).post(any(), any(), any(), any(), any(), any(), any(), any());
    }
}
