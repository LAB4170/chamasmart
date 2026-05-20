package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GovernanceService {

    private final MeetingRepository meetingRepository;
    private final NotificationRepository notificationRepository;
    private final InviteRepository inviteRepository;
    private final JoinRequestRepository joinRequestRepository;
    private final ChamaRepository chamaRepository;
    private final UserRepository userRepository;
    private final ChamaMemberRepository chamaMemberRepository;

    // ── Role guard ──────────────────────────────────────────────────────────────

    /** Asserts that userId is an active CHAIRPERSON, SECRETARY, or TREASURER of chamaId. */
    private void validateIsOfficial(Long chamaId, Long userId) {
        ChamaMember member = chamaMemberRepository
                .findByChamaChamaIdAndUserUserId(chamaId, userId)
                .filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException(
                        "Access denied: you are not an active member of chama " + chamaId));
        String role = member.getRole() == null ? "" : member.getRole().toUpperCase();
        if (!role.equals("CHAIRPERSON") && !role.equals("TREASURER") && !role.equals("SECRETARY")) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Access denied: only officials (Chairperson, Treasurer, Secretary) may perform this action.");
        }
    }

    // ── Meeting ─────────────────────────────────────────────────────────────────

    @Transactional
    public MeetingDto createMeeting(MeetingDto dto, Long chamaId, Long creatorUserId) {
        log.info("Creating meeting '{}' for chama ID: {} by user ID: {}", dto.getTitle(), chamaId, creatorUserId);
        validateIsOfficial(chamaId, creatorUserId);

        Chama chama = chamaRepository.findById(chamaId)
                .orElseThrow(() -> new RuntimeException("Chama not found"));

        User creator = userRepository.findById(creatorUserId)
                .orElseThrow(() -> new RuntimeException("Creator user not found"));

        Meeting meeting = Meeting.builder()
                .chama(chama)
                .title(dto.getTitle())
                .description(dto.getDescription())
                .scheduledDate(dto.getScheduled_date() != null ? dto.getScheduled_date() : ZonedDateTime.now().plusDays(7))
                .location(dto.getLocation())
                .meetingType(dto.getMeeting_type() != null ? dto.getMeeting_type() : "REGULAR")
                .status("SCHEDULED")
                .createdBy(creator)
                .agenda(dto.getAgenda() != null ? dto.getAgenda() : "[]")
                .meetingLink(dto.getMeeting_link())
                .build();

        Meeting savedMeeting = meetingRepository.save(meeting);
        log.info("Successfully created meeting ID: {}", savedMeeting.getMeetingId());

        // Push notification to all active members
        List<ChamaMember> members = chamaMemberRepository.findByChamaChamaIdAndIsActiveTrue(chamaId);
        for (ChamaMember member : members) {
            Notification n = Notification.builder()
                    .user(member.getUser())
                    .title("New Meeting Scheduled: " + savedMeeting.getTitle())
                    .message("A new meeting has been scheduled for " + savedMeeting.getScheduledDate() + " at " + savedMeeting.getLocation())
                    .type("MEETING_INVITE")
                    .entityType("MEETING")
                    .entityId(savedMeeting.getMeetingId())
                    .build();
            notificationRepository.save(n);
        }

        return MeetingDto.fromEntity(savedMeeting);
    }

    // ── Invite ──────────────────────────────────────────────────────────────────

    @Transactional
    public InviteDto createInvite(InviteDto dto, Long chamaId, Long inviterUserId) {
        log.info("Creating invite for chama ID: {} by user ID: {}", chamaId, inviterUserId);
        validateIsOfficial(chamaId, inviterUserId);

        Chama chama = chamaRepository.findById(chamaId)
                .orElseThrow(() -> new RuntimeException("Chama not found"));

        User inviter = userRepository.findById(inviterUserId)
                .orElseThrow(() -> new RuntimeException("Inviter user not found"));

        String inviteCode = UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        Invite invite = Invite.builder()
                .chama(chama)
                .invitedBy(inviter)
                .inviteCode(inviteCode)
                .email(dto.getEmail())
                .phoneNumber(dto.getPhone_number())
                .role(dto.getRole() != null ? dto.getRole() : "MEMBER")
                .status("ACTIVE")
                .expiresAt(ZonedDateTime.now().plusDays(7))
                .build();

        Invite savedInvite = inviteRepository.save(invite);
        log.info("Successfully created invite code: {}", inviteCode);
        return InviteDto.fromEntity(savedInvite);
    }

    @Transactional
    public InviteDto acceptInvite(String inviteCode, Long acceptingUserId) {
        log.info("Accepting invite code: {} by user ID: {}", inviteCode, acceptingUserId);
        Invite invite = inviteRepository.findByInviteCode(inviteCode)
                .orElseThrow(() -> new RuntimeException("Invite not found or invalid code"));

        if (!"ACTIVE".equals(invite.getStatus()) || invite.getExpiresAt().isBefore(ZonedDateTime.now())) {
            throw new RuntimeException("Invite has expired or is no longer active");
        }

        User user = userRepository.findById(acceptingUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        invite.setStatus("ACCEPTED");
        invite.setAcceptedAt(ZonedDateTime.now());
        invite.setAcceptedBy(user);
        Invite updatedInvite = inviteRepository.save(invite);

        // Add user as ChamaMember
        Optional<ChamaMember> existingMember = chamaMemberRepository.findByChamaChamaIdAndUserUserId(invite.getChama().getChamaId(), acceptingUserId);
        if (existingMember.isEmpty()) {
            ChamaMember newMember = ChamaMember.builder()
                    .chama(invite.getChama())
                    .user(user)
                    .role(invite.getRole())
                    .isActive(true)
                    .build();
            chamaMemberRepository.save(newMember);
        }

        return InviteDto.fromEntity(updatedInvite);
    }

    @Transactional
    public JoinRequestDto createJoinRequest(JoinRequestDto dto, Long chamaId, Long requestingUserId) {
        log.info("Creating join request for chama ID: {} by user ID: {}", chamaId, requestingUserId);
        Chama chama = chamaRepository.findById(chamaId)
                .orElseThrow(() -> new RuntimeException("Chama not found"));

        User user = userRepository.findById(requestingUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Optional<JoinRequest> existing = joinRequestRepository.findByChamaChamaIdAndUserUserId(chamaId, requestingUserId);
        if (existing.isPresent() && "PENDING".equals(existing.get().getStatus())) {
            throw new RuntimeException("A pending join request already exists for this group");
        }

        JoinRequest request = JoinRequest.builder()
                .chama(chama)
                .user(user)
                .message(dto.getMessage())
                .status("PENDING")
                .build();

        JoinRequest savedRequest = joinRequestRepository.save(request);
        log.info("Successfully created join request ID: {}", savedRequest.getRequestId());
        return JoinRequestDto.fromEntity(savedRequest);
    }

    @Transactional
    public JoinRequestDto reviewJoinRequest(Long requestId, Long reviewerUserId, String decision, String comments) {
        log.info("Reviewing join request ID: {} by user ID: {}, decision: {}", requestId, reviewerUserId, decision);
        JoinRequest request = joinRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Join request not found"));

        if (!"PENDING".equals(request.getStatus())) {
            throw new RuntimeException("Join request is already processed");
        }

        User reviewer = userRepository.findById(reviewerUserId)
                .orElseThrow(() -> new RuntimeException("Reviewer user not found"));

        request.setStatus(decision.toUpperCase()); // APPROVED, REJECTED
        request.setReviewedAt(ZonedDateTime.now());
        request.setReviewedBy(reviewer);
        request.setReviewComments(comments);

        if ("APPROVED".equalsIgnoreCase(decision)) {
            // Add user as ChamaMember
            Optional<ChamaMember> existingMember = chamaMemberRepository.findByChamaChamaIdAndUserUserId(request.getChama().getChamaId(), request.getUser().getUserId());
            if (existingMember.isEmpty()) {
                ChamaMember newMember = ChamaMember.builder()
                        .chama(request.getChama())
                        .user(request.getUser())
                        .role("MEMBER")
                        .isActive(true)
                        .build();
                chamaMemberRepository.save(newMember);
            }

            // Notify user
            Notification n = Notification.builder()
                    .user(request.getUser())
                    .title("Join Request Approved")
                    .message("Your request to join " + request.getChama().getChamaName() + " has been approved!")
                    .type("JOIN_APPROVED")
                    .entityType("CHAMA")
                    .entityId(request.getChama().getChamaId())
                    .build();
            notificationRepository.save(n);
        } else {
            // Notify user of rejection
            Notification n = Notification.builder()
                    .user(request.getUser())
                    .title("Join Request Declined")
                    .message("Your request to join " + request.getChama().getChamaName() + " was declined. Comments: " + comments)
                    .type("JOIN_REJECTED")
                    .entityType("CHAMA")
                    .entityId(request.getChama().getChamaId())
                    .build();
            notificationRepository.save(n);
        }

        JoinRequest updatedRequest = joinRequestRepository.save(request);
        return JoinRequestDto.fromEntity(updatedRequest);
    }

    @Transactional(readOnly = true)
    public List<MeetingDto> getMeetingsByChamaId(Long chamaId) {
        return meetingRepository.findByChamaChamaIdOrderByScheduledDateDesc(chamaId).stream()
                .map(MeetingDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<NotificationDto> getMyNotifications(Long userId) {
        return notificationRepository.findByUserUserIdOrderByCreatedAtDesc(userId).stream()
                .map(NotificationDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional
    public void markNotificationAsRead(Long notificationId, Long userId) {
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));

        if (n.getUser().getUserId().equals(userId)) {
            n.setIsRead(true);
            n.setReadAt(ZonedDateTime.now());
            notificationRepository.save(n);
        }
    }

    @Transactional(readOnly = true)
    public List<InviteDto> getInvitesByChamaId(Long chamaId, String status) {
        return inviteRepository.findByChamaChamaIdAndStatus(chamaId, status).stream()
                .map(InviteDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<JoinRequestDto> getJoinRequestsByChamaId(Long chamaId, String status) {
        return joinRequestRepository.findByChamaChamaIdAndStatus(chamaId, status).stream()
                .map(JoinRequestDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deactivateInvite(Long inviteId) {
        log.info("Deactivating invite ID: {}", inviteId);
        inviteRepository.findById(inviteId).ifPresent(invite -> {
            invite.setStatus("REVOKED");
            inviteRepository.save(invite);
        });
    }
}
