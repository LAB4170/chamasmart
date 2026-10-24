package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Set;

/** Who can see, add, remove and promote members, and the two-official handshake for retiring a chama. */
@Service
@RequiredArgsConstructor
@Slf4j
public class MembershipService {
    public static final Set<String> ASSIGNABLE_ROLES = Set.of("MEMBER", "TREASURER", "SECRETARY");
    private static final List<String> OPEN_LOAN = List.of("PENDING", "APPROVED", "DISBURSED", "ACTIVE", "DEFAULTED");

    private final ChamaRepository chamaRepository;
    private final ChamaMemberRepository chamaMemberRepository;
    private final UserRepository userRepository;
    private final LoanRepository loanRepository;
    private final com.chamasmart.backend.repository.LoanGuarantorRepository loanGuarantorRepository;

    public ChamaMember activeMember(Long chamaId, Long userId) {
        return chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, userId)
                .filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new AccessDeniedException("You are not an active member of this chama"));
    }

    private static String role(ChamaMember m) {
        return m.getRole() == null ? "" : m.getRole().toUpperCase();
    }

    public static boolean isOfficial(ChamaMember m) {
        String r = role(m);
        return r.equals("CHAIRPERSON") || r.equals("TREASURER") || r.equals("SECRETARY");
    }

    public ChamaMember activeOfficial(Long chamaId, Long userId) {
        ChamaMember m = activeMember(chamaId, userId);
        if (!isOfficial(m)) throw new AccessDeniedException("Only chama officials can do this");
        return m;
    }

    public ChamaMember chairperson(Long chamaId, Long userId) {
        ChamaMember m = activeMember(chamaId, userId);
        if (!role(m).equals("CHAIRPERSON")) throw new AccessDeniedException("Only the chairperson can do this");
        return m;
    }

    /** Keeps the stored head-count equal to the number of active members. */
    public void syncMemberCount(Chama chama) {
        chama.setTotalMembers((int) chamaMemberRepository.countByChamaChamaIdAndIsActiveTrue(chama.getChamaId()));
        chamaRepository.save(chama);
    }

    @Transactional
    public ChamaMember addMember(Long chamaId, Long actorId, Long targetUserId, String requestedRole) {
        ChamaMember actor = activeOfficial(chamaId, actorId);
        String newRole = requestedRole == null || requestedRole.isBlank() ? "MEMBER" : requestedRole.trim().toUpperCase();
        if (!ASSIGNABLE_ROLES.contains(newRole)) throw new IllegalArgumentException("Role must be MEMBER, TREASURER or SECRETARY");
        if (!newRole.equals("MEMBER") && !role(actor).equals("CHAIRPERSON")) {
            throw new AccessDeniedException("Only the chairperson can appoint officials");
        }
        if (targetUserId == null) throw new IllegalArgumentException("Choose a member to add");
        Chama chama = chamaRepository.findById(chamaId).filter(c -> Boolean.TRUE.equals(c.getIsActive()))
                .orElseThrow(() -> new IllegalArgumentException("Chama not found"));
        User user = userRepository.findById(targetUserId).orElseThrow(() -> new IllegalArgumentException("User not found"));
        ChamaMember member = chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, targetUserId).orElse(null);
        if (member != null && Boolean.TRUE.equals(member.getIsActive())) throw new IllegalStateException("This person is already a member");
        if (member == null) {
            member = ChamaMember.builder().chama(chama).user(user).role(newRole).status("ACTIVE").totalContributions(BigDecimal.ZERO).isActive(true).build();
        } else {
            member.setIsActive(true);
            member.setStatus("ACTIVE");
            member.setRole(newRole);
        }
        ChamaMember saved = chamaMemberRepository.save(member);
        syncMemberCount(chama);
        return saved;
    }

    @Transactional
    public void removeMember(Long chamaId, Long actorId, Long targetUserId) {
        ChamaMember actor = activeOfficial(chamaId, actorId);
        ChamaMember target = chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, targetUserId)
                .filter(ChamaMember::getIsActive).orElseThrow(() -> new IllegalArgumentException("That person is not an active member"));
        if (role(target).equals("CHAIRPERSON")) throw new IllegalStateException("The chairperson cannot be removed. Hand over the role first");
        if (isOfficial(target) && !role(actor).equals("CHAIRPERSON")) throw new AccessDeniedException("Only the chairperson can remove an official");
        boolean openLoan = loanRepository.findByBorrowerUserId(targetUserId).stream()
                .anyMatch(l -> l.getChama().getChamaId().equals(chamaId) && OPEN_LOAN.contains(String.valueOf(l.getStatus()).toUpperCase()));
        if (openLoan) throw new IllegalStateException("This member has a loan that is not settled yet");
        boolean guaranteeing = loanGuarantorRepository.findByGuarantorUserUserId(targetUserId).stream()
                .anyMatch(g -> g.getLoan().getChama().getChamaId().equals(chamaId)
                        && !"REJECTED".equalsIgnoreCase(g.getStatus())
                        && OPEN_LOAN.contains(String.valueOf(g.getLoan().getStatus()).toUpperCase()));
        if (guaranteeing) throw new IllegalStateException("This member is guaranteeing a loan that is not settled yet. The borrower must repay or replace the guarantor first");
        target.setIsActive(false);
        target.setStatus("INACTIVE");
        chamaMemberRepository.save(target);
        syncMemberCount(target.getChama());
    }

    @Transactional
    public ChamaMember updateRole(Long chamaId, Long actorId, Long targetUserId, String requestedRole) {
        chairperson(chamaId, actorId);
        String newRole = requestedRole == null ? "" : requestedRole.trim().toUpperCase();
        if (!ASSIGNABLE_ROLES.contains(newRole)) throw new IllegalArgumentException("Role must be MEMBER, TREASURER or SECRETARY");
        if (actorId.equals(targetUserId)) throw new IllegalStateException("The chairperson cannot change their own role here");
        ChamaMember target = chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, targetUserId)
                .filter(ChamaMember::getIsActive).orElseThrow(() -> new IllegalArgumentException("That person is not an active member"));
        target.setRole(newRole);
        return chamaMemberRepository.save(target);
    }

    /**
     * Retiring a chama needs two different officials. The first call records the request; a different official's call confirms it.
     * A chama with money in it or unsettled loans cannot be retired. Returns true once the chama is retired.
     */
    @Transactional
    public boolean requestOrConfirmRetirement(Long chamaId, Long actorId) {
        activeOfficial(chamaId, actorId);
        Chama chama = chamaRepository.findByIdWithPessimisticLock(chamaId).orElseThrow(() -> new IllegalArgumentException("Chama not found"));
        if (!Boolean.TRUE.equals(chama.getIsActive())) throw new IllegalStateException("This chama is already retired");
        if (chama.getDeletionRequestedBy() == null) {
            chama.setDeletionRequestedBy(actorId);
            chama.setDeletionRequestedAt(ZonedDateTime.now());
            chamaRepository.save(chama);
            return false;
        }
        if (chama.getDeletionRequestedBy().equals(actorId)) throw new IllegalStateException("You already asked to retire this chama. A different official must confirm");
        if (chama.getCurrentFund() != null && chama.getCurrentFund().signum() > 0) {
            throw new IllegalStateException("The chama still holds KES " + chama.getCurrentFund().toPlainString() + ". Pay it out before retiring the group");
        }
        boolean openLoan = loanRepository.findByChamaChamaId(chamaId).stream().anyMatch(l -> OPEN_LOAN.contains(String.valueOf(l.getStatus()).toUpperCase()));
        if (openLoan) throw new IllegalStateException("There are loans that are not settled yet");
        chama.setIsActive(false);
        chama.setDeletionRequestedBy(null);
        chama.setDeletionRequestedAt(null);
        chamaRepository.save(chama);
        return true;
    }

    @Transactional
    public void cancelRetirement(Long chamaId, Long actorId) {
        activeOfficial(chamaId, actorId);
        Chama chama = chamaRepository.findByIdWithPessimisticLock(chamaId).orElseThrow(() -> new IllegalArgumentException("Chama not found"));
        chama.setDeletionRequestedBy(null);
        chama.setDeletionRequestedAt(null);
        chamaRepository.save(chama);
    }
}
