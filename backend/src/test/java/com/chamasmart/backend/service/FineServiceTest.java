package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
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
class FineServiceTest {
    @Mock MemberFineRepository fines;
    @Mock ChamaRepository chamaRepo;
    @Mock UserRepository userRepo;
    @Mock MembershipService membership;
    @Mock NotificationRepository notifRepo;
    @Mock FinancialAuditLogRepository auditRepo;
    FineService service;
    Chama chama;

    private static User user(long id) { User u = new User(); u.setUserId(id); u.setFirstName("U" + id); u.setLastName("X"); return u; }
    private MemberFine fine(long id, String amount, String paid) {
        return MemberFine.builder().fineId(id).chama(chama).user(user(8)).amount(new BigDecimal(amount)).amountPaid(new BigDecimal(paid)).reason("late").status("OWED").build();
    }

    @BeforeEach
    void setUp() {
        chama = Chama.builder().chamaId(1L).chamaName("G").chamaType("ROSCA").build();
        service = new FineService(fines, chamaRepo, userRepo, membership, notifRepo, auditRepo);
        when(chamaRepo.findById(1L)).thenReturn(Optional.of(chama));
        when(userRepo.findById(8L)).thenReturn(Optional.of(user(8)));
        when(fines.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void membersCannotIssueFines() {
        when(membership.activeOfficial(1L, 8L)).thenThrow(new AccessDeniedException("no"));
        assertThrows(AccessDeniedException.class, () -> service.issue(1L, 8L, 9L, BigDecimal.TEN, "rude"));
    }

    @Test
    void officialCannotFineThemselvesOrUseBadAmounts() {
        assertThrows(IllegalArgumentException.class, () -> service.issue(1L, 7L, 7L, BigDecimal.TEN, "rude"));
        assertThrows(IllegalArgumentException.class, () -> service.issue(1L, 7L, 8L, BigDecimal.ZERO, "rude"));
        assertThrows(IllegalArgumentException.class, () -> service.issue(1L, 7L, 8L, BigDecimal.TEN, " "));
    }

    @Test
    void issuedFineIsOwedAndNotifiesTheMember() {
        var out = service.issue(1L, 7L, 8L, new BigDecimal("250"), "Missed the meeting");
        assertEquals("OWED", out.get("status"));
        verify(notifRepo).save(any());
        verify(auditRepo).save(any());
    }

    @Test
    void lateRoundFineIsNeverIssuedTwice() {
        RoscaCycle cycle = RoscaCycle.builder().cycleId(5L).chama(chama).cycleName("C1").build();
        when(fines.existsBySourceAndCycleIdAndRoundNoAndUserUserId("ROSCA_LATE", 5L, 2, 8L)).thenReturn(true);
        assertFalse(service.issueLateRoundFine(chama, cycle, 2, user(8), new BigDecimal("100")));
        verify(fines, never()).save(any());
        when(fines.existsBySourceAndCycleIdAndRoundNoAndUserUserId("ROSCA_LATE", 5L, 3, 8L)).thenReturn(false);
        assertTrue(service.issueLateRoundFine(chama, cycle, 3, user(8), new BigDecimal("100")));
    }

    @Test
    void paymentsSettleOldestFinesFirstAndPartlyWhenShort() {
        MemberFine a = fine(1, "100", "0"), b = fine(2, "200", "0");
        when(fines.findByChamaChamaIdAndUserUserIdAndStatusOrderByCreatedAtAsc(1L, 8L, "OWED")).thenReturn(List.of(a, b));
        BigDecimal left = service.settle(1L, 8L, new BigDecimal("150"));
        assertEquals(0, left.signum());
        assertEquals("PAID", a.getStatus());
        assertEquals("OWED", b.getStatus());
        assertEquals(new BigDecimal("50"), b.getAmountPaid());
        assertEquals(new BigDecimal("150"), b.outstanding());
    }

    @Test
    void overpaymentLeavesAnExcessAndNothingIsOwed() {
        MemberFine a = fine(1, "100", "0");
        when(fines.findByChamaChamaIdAndUserUserIdAndStatusOrderByCreatedAtAsc(1L, 8L, "OWED")).thenReturn(List.of(a));
        assertEquals(new BigDecimal("40"), service.settle(1L, 8L, new BigDecimal("140")));
        assertEquals("PAID", a.getStatus());
    }

    @Test
    void waivingNeedsAReasonAndCannotBeDoneOnYourOwnFine() {
        MemberFine own = fine(3, "100", "0"); own.setUser(user(7));
        MemberFine other = fine(4, "100", "0");
        when(fines.findById(3L)).thenReturn(Optional.of(own));
        when(fines.findById(4L)).thenReturn(Optional.of(other));
        assertThrows(IllegalArgumentException.class, () -> service.waive(1L, 7L, 3L, "ok fine"));
        assertThrows(IllegalArgumentException.class, () -> service.waive(1L, 7L, 4L, ""));
        assertEquals("WAIVED", service.waive(1L, 7L, 4L, "Was in hospital").get("status"));
    }
}
