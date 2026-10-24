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
import java.util.Optional;

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
}
