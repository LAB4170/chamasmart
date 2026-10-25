package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.InviteDto;
import com.chamasmart.backend.dto.JoinRequestDto;
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
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MembershipAndGovernanceTest {
    @Mock ChamaRepository chamaRepo;
    @Mock ChamaMemberRepository memberRepo;
    @Mock UserRepository userRepo;
    @Mock LoanRepository loanRepo;
    @Mock LoanGuarantorRepository guarantorRepo;
    @Mock MeetingRepository meetingRepo;
    @Mock NotificationRepository notifRepo;
    @Mock InviteRepository inviteRepo;
    @Mock JoinRequestRepository joinRepo;

    MembershipService membership;
    GovernanceService governance;
    Chama chama;

    private static User user(long id, String email) { User u = new User(); u.setUserId(id); u.setFirstName("U" + id); u.setLastName("X"); u.setEmail(email); u.setEmailVerified(true); return u; }
    private ChamaMember member(long id, String role, boolean active) {
        ChamaMember m = ChamaMember.builder().chama(chama).user(user(id, "u" + id + "@x.com")).role(role).isActive(active).build();
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, id)).thenReturn(Optional.of(m));
        return m;
    }

    @BeforeEach
    void setUp() {
        chama = Chama.builder().chamaId(1L).chamaName("G").isActive(true).visibility("PUBLIC").currentFund(BigDecimal.ZERO).build();
        when(chamaRepo.findById(1L)).thenReturn(Optional.of(chama));
        when(chamaRepo.findByIdWithPessimisticLock(1L)).thenReturn(Optional.of(chama));
        for (long i = 1; i <= 9; i++) when(userRepo.findById(i)).thenReturn(Optional.of(user(i, "u" + i + "@x.com")));
        when(memberRepo.save(any(ChamaMember.class))).thenAnswer(i -> i.getArgument(0));
        when(inviteRepo.save(any(Invite.class))).thenAnswer(i -> i.getArgument(0));
        when(joinRepo.save(any(JoinRequest.class))).thenAnswer(i -> i.getArgument(0));
        membership = new MembershipService(chamaRepo, memberRepo, userRepo, loanRepo, guarantorRepo, mock(com.chamasmart.backend.repository.ContributionRepository.class), mock(com.chamasmart.backend.repository.RoscaCycleRepository.class), mock(com.chamasmart.backend.repository.RoscaRosterRepository.class));
        governance = new GovernanceService(meetingRepo, notifRepo, inviteRepo, joinRepo, chamaRepo, userRepo, memberRepo, membership);
    }

    // ---- join requests ----
    private JoinRequest pendingRequest(long requester) {
        JoinRequest r = JoinRequest.builder().requestId(50L).chama(chama).user(user(requester, "r@x.com")).status("PENDING").build();
        when(joinRepo.findById(50L)).thenReturn(Optional.of(r));
        return r;
    }

    @Test void ordinaryUserCannotApproveAJoinRequest() {
        pendingRequest(9);
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 8L)).thenReturn(Optional.empty());
        assertThrows(AccessDeniedException.class, () -> governance.reviewJoinRequest(50L, 8L, "APPROVED", null));
    }

    @Test void applicantCannotApproveTheirOwnRequest() {
        pendingRequest(5);
        member(5, "MEMBER", false);
        assertThrows(AccessDeniedException.class, () -> governance.reviewJoinRequest(50L, 5L, "APPROVED", null));
        verify(memberRepo, never()).save(any());
    }

    @Test void officialApprovalAddsTheMember() {
        JoinRequest r = pendingRequest(9);
        member(7, "TREASURER", true);
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 9L)).thenReturn(Optional.empty());
        governance.reviewJoinRequest(50L, 7L, "APPROVED", null);
        assertEquals("APPROVED", r.getStatus());
        verify(memberRepo).save(argThat(m -> m.getUser().getUserId().equals(9L) && "MEMBER".equals(m.getRole())));
    }

    @Test void reviewedRequestCannotBeReviewedAgain() {
        JoinRequest r = pendingRequest(9); r.setStatus("REJECTED");
        member(7, "TREASURER", true);
        assertThrows(IllegalStateException.class, () -> governance.reviewJoinRequest(50L, 7L, "APPROVED", null));
    }

    @Test void privateChamaCannotBeJoinedByRequest() {
        chama.setVisibility("PRIVATE");
        assertThrows(AccessDeniedException.class, () -> governance.createJoinRequest(new JoinRequestDto(), 1L, 9L));
    }

    @Test void existingMemberCannotRequestToJoin() {
        when(memberRepo.existsByChamaChamaIdAndUserUserIdAndIsActiveTrue(1L, 9L)).thenReturn(true);
        assertThrows(IllegalStateException.class, () -> governance.createJoinRequest(new JoinRequestDto(), 1L, 9L));
    }

    @Test void onlyOfficialsSeeRequestsAndInvites() {
        member(5, "MEMBER", true);
        assertThrows(AccessDeniedException.class, () -> governance.getJoinRequestsByChamaId(1L, "PENDING", 5L));
        assertThrows(AccessDeniedException.class, () -> governance.getInvitesByChamaId(1L, "ACTIVE", 5L));
    }

    // ---- invites ----
    @Test void inviteCannotOfferTheChairpersonRole() {
        member(7, "CHAIRPERSON", true);
        InviteDto d = new InviteDto(); d.setRole("CHAIRPERSON");
        assertThrows(IllegalArgumentException.class, () -> governance.createInvite(d, 1L, 7L));
    }

    @Test void onlyTheChairpersonCanInviteOfficials() {
        member(7, "TREASURER", true);
        InviteDto d = new InviteDto(); d.setRole("SECRETARY");
        assertThrows(AccessDeniedException.class, () -> governance.createInvite(d, 1L, 7L));
    }

    private Invite invite(String email) {
        Invite i = Invite.builder().chama(chama).invitedBy(user(7, "a@x.com")).inviteCode("ABC123").email(email).role("MEMBER").status("ACTIVE").expiresAt(ZonedDateTime.now().plusDays(1)).build();
        when(inviteRepo.findByInviteCode("ABC123")).thenReturn(Optional.of(i));
        return i;
    }

    @Test void inviteAddressedToSomeoneElseCannotBeUsed() {
        invite("other@x.com");
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 9L)).thenReturn(Optional.empty());
        assertThrows(AccessDeniedException.class, () -> governance.acceptInvite("ABC123", 9L));
    }

    @Test void validInviteMakesAMemberOnceAndIsConsumed() {
        Invite i = invite("u9@x.com");
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 9L)).thenReturn(Optional.empty());
        governance.acceptInvite("ABC123", 9L);
        assertEquals("ACCEPTED", i.getStatus());
        assertThrows(IllegalStateException.class, () -> governance.acceptInvite("ABC123", 9L));
    }

    @Test void deactivatingAnInviteRequiresAnOfficialOfThatChama() {
        Invite i = invite(null); i.setInviteId(3L);
        when(inviteRepo.findById(3L)).thenReturn(Optional.of(i));
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 5L)).thenReturn(Optional.empty());
        assertThrows(AccessDeniedException.class, () -> governance.deactivateInvite(3L, 5L));
        assertEquals("ACTIVE", i.getStatus());
    }

    // ---- members ----
    @Test void memberListNeedsMembership() {
        when(memberRepo.findByChamaChamaIdAndUserUserId(1L, 8L)).thenReturn(Optional.empty());
        assertThrows(AccessDeniedException.class, () -> membership.activeMember(1L, 8L));
    }

    @Test void treasurerCannotAppointOfficials() {
        member(7, "TREASURER", true);
        assertThrows(AccessDeniedException.class, () -> membership.addMember(1L, 7L, 9L, "TREASURER"));
    }

    @Test void nobodyCanBeAddedAsChairperson() {
        member(7, "CHAIRPERSON", true);
        assertThrows(IllegalArgumentException.class, () -> membership.addMember(1L, 7L, 9L, "CHAIRPERSON"));
    }

    @Test void chairpersonCannotBeRemoved() {
        member(7, "TREASURER", true); member(6, "CHAIRPERSON", true);
        assertThrows(IllegalStateException.class, () -> membership.removeMember(1L, 7L, 6L));
    }

    @Test void memberWithAnOpenLoanCannotBeRemoved() {
        member(7, "TREASURER", true); member(5, "MEMBER", true);
        Loan l = new Loan(); l.setChama(chama); l.setStatus("DISBURSED");
        when(loanRepo.findByBorrowerUserId(5L)).thenReturn(List.of(l));
        assertThrows(IllegalStateException.class, () -> membership.removeMember(1L, 7L, 5L));
    }

    @Test void memberGuaranteeingAnOpenLoanCannotBeRemoved() {
        member(7, "TREASURER", true); member(5, "MEMBER", true);
        Loan l = new Loan(); l.setChama(chama); l.setStatus("ACTIVE");
        LoanGuarantor g = new LoanGuarantor(); g.setLoan(l); g.setStatus("APPROVED");
        when(guarantorRepo.findByGuarantorUserUserId(5L)).thenReturn(List.of(g));
        assertThrows(IllegalStateException.class, () -> membership.removeMember(1L, 7L, 5L));
    }

    @Test void onlyChairpersonChangesRolesAndNotToChairperson() {
        member(7, "TREASURER", true);
        assertThrows(AccessDeniedException.class, () -> membership.updateRole(1L, 7L, 5L, "SECRETARY"));
        member(6, "CHAIRPERSON", true); member(5, "MEMBER", true);
        assertThrows(IllegalArgumentException.class, () -> membership.updateRole(1L, 6L, 5L, "CHAIRPERSON"));
        assertEquals("SECRETARY", membership.updateRole(1L, 6L, 5L, "SECRETARY").getRole());
    }

    // ---- retirement handshake ----
    @Test void retirementNeedsTwoDifferentOfficials() {
        member(6, "CHAIRPERSON", true); member(7, "TREASURER", true);
        assertFalse(membership.requestOrConfirmRetirement(1L, 6L));
        assertEquals(6L, chama.getDeletionRequestedBy());
        assertThrows(IllegalStateException.class, () -> membership.requestOrConfirmRetirement(1L, 6L));
        assertTrue(membership.requestOrConfirmRetirement(1L, 7L));
        assertFalse(chama.getIsActive());
    }

    @Test void chamaHoldingMoneyCannotBeRetired() {
        member(6, "CHAIRPERSON", true); member(7, "TREASURER", true);
        chama.setCurrentFund(new BigDecimal("500"));
        membership.requestOrConfirmRetirement(1L, 6L);
        assertThrows(IllegalStateException.class, () -> membership.requestOrConfirmRetirement(1L, 7L));
        assertTrue(chama.getIsActive());
    }

    @org.junit.jupiter.api.Test
    void unverifiedEmailCannotBeAppointedOfficial() {
        User u = user(99, "x@y.z");
        u.setEmailVerified(false);
        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class, () -> MembershipService.requireVerifiedForOffice(u, "TREASURER"));
        MembershipService.requireVerifiedForOffice(u, "MEMBER");
    }

    @org.junit.jupiter.api.Test
    void officialsNeedTwoFactorWhenTheSwitchIsOn() throws Exception {
        MfaService mfa = mock(MfaService.class);
        when(mfa.enforcesOfficials()).thenReturn(true);
        var field = MembershipService.class.getDeclaredField("mfaService");
        field.setAccessible(true);
        field.set(membership, mfa);
        member(6, "TREASURER", true);

        when(mfa.isEnabled(6L)).thenReturn(false);
        org.junit.jupiter.api.Assertions.assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> membership.activeOfficial(1L, 6L));

        when(mfa.isEnabled(6L)).thenReturn(true);
        org.junit.jupiter.api.Assertions.assertNotNull(membership.activeOfficial(1L, 6L));
    }
}
