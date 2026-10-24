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
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class WelfareServiceTest {
    @Mock WelfareConfigRepository configRepo;
    @Mock WelfareFundRepository fundRepo;
    @Mock WelfareClaimRepository claimRepo;
    @Mock WelfareClaimApprovalRepository approvalRepo;
    @Mock ChamaRepository chamaRepo;
    @Mock UserRepository userRepo;
    @Mock ChamaMemberRepository memberRepo;
    @Mock FinancialAuditLogRepository auditRepo;

    WelfareService service;
    Chama chama;
    WelfareClaim claim;
    WelfareFund fund;
    final List<WelfareClaimApproval> approvals = new ArrayList<>();

    private static User user(long id) { User u = new User(); u.setUserId(id); u.setFirstName("U" + id); u.setLastName("X"); return u; }
    private void official(long id, String role) {
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, id)).thenReturn(Optional.of(
                ChamaMember.builder().chama(chama).user(user(id)).role(role).isActive(true).build()));
        when(userRepo.findById(id)).thenReturn(Optional.of(user(id)));
    }

    @BeforeEach
    void setUp() {
        chama = Chama.builder().chamaId(1L).chamaName("G").build();
        claim = WelfareClaim.builder().claimId(10L).chama(chama).member(user(5)).eventType(WelfareConfig.builder().eventType("Bereavement").build()).claimAmount(new BigDecimal("3000")).status("SUBMITTED").build();
        fund = WelfareFund.builder().chama(chama).balance(new BigDecimal("10000")).build();
        when(claimRepo.findByIdWithPessimisticLock(10L)).thenReturn(Optional.of(claim));
        when(claimRepo.save(any(WelfareClaim.class))).thenAnswer(i -> i.getArgument(0));
        when(fundRepo.findByChamaIdWithPessimisticLock(1L)).thenReturn(Optional.of(fund));
        when(approvalRepo.findByClaimClaimId(10L)).thenAnswer(i -> new ArrayList<>(approvals));
        when(approvalRepo.save(any(WelfareClaimApproval.class))).thenAnswer(i -> { approvals.add(i.getArgument(0)); return i.getArgument(0); });
        service = new WelfareService(configRepo, fundRepo, claimRepo, approvalRepo, chamaRepo, userRepo, memberRepo, auditRepo);
    }

    @Test void sameOfficialCannotApproveTwice() {
        official(7, "TREASURER");
        service.approveClaim(10L, 7L, "APPROVED", null);
        assertThrows(IllegalStateException.class, () -> service.approveClaim(10L, 7L, "APPROVED", null));
        assertEquals("SUBMITTED", claim.getStatus());
        assertEquals(0, new BigDecimal("10000").compareTo(fund.getBalance()));
    }

    @Test void twoDifferentOfficialsApproveAndPayFromTheFund() {
        official(7, "TREASURER"); official(8, "CHAIRPERSON");
        service.approveClaim(10L, 7L, "APPROVED", null);
        service.approveClaim(10L, 8L, "APPROVED", null);
        assertEquals("PAID", claim.getStatus());
        assertEquals(0, new BigDecimal("7000").compareTo(fund.getBalance()));
    }

    @Test void claimantCannotDecideOnTheirOwnClaim() {
        official(5, "TREASURER");
        assertThrows(AccessDeniedException.class, () -> service.approveClaim(10L, 5L, "APPROVED", null));
    }

    @Test void ordinaryMemberCannotApprove() {
        official(6, "MEMBER");
        assertThrows(AccessDeniedException.class, () -> service.approveClaim(10L, 6L, "APPROVED", null));
    }

    @Test void missingDecisionIsRejectedNotACrash() {
        official(7, "TREASURER");
        assertThrows(IllegalArgumentException.class, () -> service.approveClaim(10L, 7L, null, null));
    }

    @Test void oneRejectionClosesTheClaim() {
        official(7, "TREASURER");
        service.approveClaim(10L, 7L, "REJECTED", "No proof");
        assertEquals("REJECTED", claim.getStatus());
    }

    @Test void outsiderCannotReadTheLedger() {
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 9L)).thenReturn(Optional.empty());
        assertThrows(AccessDeniedException.class, () -> service.getLedger(1L, 9L));
    }

    @Test void aClaimMustUseAnEventTypeSetUpByOfficials() {
        official(5, "MEMBER");
        when(chamaRepo.findById(1L)).thenReturn(Optional.of(chama));
        var req = new com.chamasmart.backend.dto.WelfareClaimRequestDto();
        req.setChama_id(1L);
        req.setCustom_event_name("Holiday");
        req.setClaim_amount(new BigDecimal("999999"));
        assertThrows(IllegalArgumentException.class, () -> service.fileClaim(req, 5L));
        verify(configRepo, never()).save(any());
        verify(claimRepo, never()).save(argThat(c -> "SUBMITTED".equals(c.getStatus()) && c.getClaimId() == null));
    }
}
