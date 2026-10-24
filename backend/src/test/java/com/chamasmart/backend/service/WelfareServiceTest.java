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
import java.time.ZonedDateTime;
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
    @Mock LedgerService ledger;
    @Mock LoanRepository loanRepo;

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
        service = new WelfareService(configRepo, fundRepo, claimRepo, approvalRepo, chamaRepo, userRepo, memberRepo, auditRepo, ledger, loanRepo);
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

    @Test void shortFundLeavesClaimApprovedThenPayClearsItAfterTopUp() {
        official(7, "TREASURER"); official(8, "CHAIRPERSON");
        fund.setBalance(new BigDecimal("1000"));
        service.approveClaim(10L, 7L, "APPROVED", null);
        service.approveClaim(10L, 8L, "APPROVED", null);
        assertEquals("APPROVED", claim.getStatus());
        assertThrows(IllegalStateException.class, () -> service.payApprovedClaim(10L, 7L));
        assertEquals("APPROVED", claim.getStatus());
        fund.setBalance(new BigDecimal("5000"));
        service.payApprovedClaim(10L, 7L);
        assertEquals("PAID", claim.getStatus());
        assertEquals(0, new BigDecimal("2000").compareTo(fund.getBalance()));
    }

    @Test void payRejectsClaimantAndNonApprovedClaims() {
        official(5, "TREASURER"); official(7, "TREASURER");
        claim.setStatus("APPROVED");
        assertThrows(AccessDeniedException.class, () -> service.payApprovedClaim(10L, 5L));
        claim.setStatus("PAID");
        assertThrows(IllegalStateException.class, () -> service.payApprovedClaim(10L, 7L));
        assertEquals(0, new BigDecimal("10000").compareTo(fund.getBalance()));
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

    private WelfareConfig cover(int waitingDays, int perYear) {
        WelfareConfig c = WelfareConfig.builder().configId(2L).chama(chama).eventType("Bereavement").payoutAmount(new BigDecimal("5000")).isActive(true)
                .waitingPeriodDays(waitingDays).maxClaimsPerYear(perYear).build();
        when(configRepo.findById(2L)).thenReturn(Optional.of(c));
        return c;
    }
    private com.chamasmart.backend.dto.WelfareClaimRequestDto request(String who, String relation) {
        var req = new com.chamasmart.backend.dto.WelfareClaimRequestDto();
        req.setChama_id(1L); req.setEvent_type_id(2L); req.setClaim_amount(new BigDecimal("3000")); req.setDescription("x");
        req.setBeneficiary_name(who); req.setBeneficiary_relationship(relation);
        return req;
    }
    private void memberSince(long days) {
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 5L)).thenReturn(Optional.of(
                ChamaMember.builder().chama(chama).user(user(5)).role("MEMBER").isActive(true).joinDate(ZonedDateTime.now().minusDays(days)).build()));
        when(userRepo.findById(5L)).thenReturn(Optional.of(user(5)));
        when(chamaRepo.findById(1L)).thenReturn(Optional.of(chama));
    }

    @Test void claimNeedsABeneficiaryAndRelationship() {
        memberSince(400); cover(0, 0);
        assertThrows(IllegalArgumentException.class, () -> service.fileClaim(request("", "child"), 5L));
        assertThrows(IllegalArgumentException.class, () -> service.fileClaim(request("Jane Doe", ""), 5L));
        var ok = service.fileClaim(request("Jane Doe", "child"), 5L);
        assertEquals("Jane Doe", ok.getBeneficiary_name());
    }

    @Test void waitingPeriodBlocksNewMembers() {
        memberSince(10); cover(90, 0);
        assertThrows(IllegalStateException.class, () -> service.fileClaim(request("Jane Doe", "child"), 5L));
        memberSince(120);
        assertNotNull(service.fileClaim(request("Jane Doe", "child"), 5L));
    }

    @Test void yearlyLimitIsEnforced() {
        memberSince(400); WelfareConfig c = cover(0, 1);
        WelfareClaim old = WelfareClaim.builder().claimId(1L).chama(chama).member(user(5)).eventType(c).claimAmount(BigDecimal.TEN).status("PAID").createdAt(ZonedDateTime.now().minusDays(30)).build();
        when(claimRepo.findByChamaChamaIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(old));
        assertThrows(IllegalStateException.class, () -> service.fileClaim(request("Jane Doe", "child"), 5L));
    }

    @Test void memberWithADefaultedLoanCannotClaim() {
        memberSince(400); cover(0, 0);
        Loan l = new Loan(); l.setChama(chama); l.setStatus("DEFAULTED");
        when(loanRepo.findByBorrowerUserId(5L)).thenReturn(List.of(l));
        assertThrows(IllegalStateException.class, () -> service.fileClaim(request("Jane Doe", "child"), 5L));
    }

    @Test void proofLinksMustBeHttps() {
        memberSince(400); cover(0, 0);
        var req = request("Jane Doe", "child"); req.setProof_document_url("javascript:alert(1)");
        assertThrows(IllegalArgumentException.class, () -> service.fileClaim(req, 5L));
    }
}
