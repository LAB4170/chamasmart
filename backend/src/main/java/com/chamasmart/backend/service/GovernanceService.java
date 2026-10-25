package com.chamasmart.backend.service;
import lombok.extern.slf4j.Slf4j;
import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
@Service
@RequiredArgsConstructor
@Slf4j
public class GovernanceService {
    private final MeetingRepository meetingRepository;
    private final NotificationRepository notificationRepository;
    private final InviteRepository inviteRepository;
    private final JoinRequestRepository joinRequestRepository;
    private final ChamaRepository chamaRepository;
    private final UserRepository userRepository;
    private final ChamaMemberRepository chamaMemberRepository;
    private final MembershipService membershipService;
    private final VerificationService verification;
    // Ã¢â€â‚¬Ã¢â€â‚¬ Role guard Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    /** Asserts that userId is an active CHAIRPERSON, SECRETARY, or TREASURER of chamaId. */
    private void validateIsOfficial(Long chamaId, Long userId) {
        ChamaMember member = chamaMemberRepository
                .findByChamaChamaIdAndUserUserId(chamaId, userId)
                .filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException(
                        "Access denied: you are not an active member of chama " + chamaId));
        String role = member.getRole() == null ? "" : member.getRole().toUpperCase();
        if (!com.chamasmart.backend.security.RolePolicy.isOfficial(role)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Access denied: only officials (Chairperson, Treasurer, Secretary) may perform this action.");
        }
    }
    // Ã¢â€â‚¬Ã¢â€â‚¬ Meeting Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
                .meetingLink(com.chamasmart.backend.util.SafeUrl.https(dto.getMeeting_link(), "meeting"))
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
    // Ã¢â€â‚¬Ã¢â€â‚¬ Invite Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    @Transactional
    public InviteDto createInvite(InviteDto dto, Long chamaId, Long inviterUserId) {
        log.info("Creating invite for chama ID: {} by user ID: {}", chamaId, inviterUserId);
        ChamaMember inviterMembership = membershipService.activeOfficial(chamaId, inviterUserId);
        String role = dto.getRole() == null || dto.getRole().isBlank() ? "MEMBER" : dto.getRole().trim().toUpperCase();
        if (!MembershipService.ASSIGNABLE_ROLES.contains(role)) {
            throw new IllegalArgumentException("An invitation can only offer the role MEMBER, TREASURER or SECRETARY");
        }
        if (!"MEMBER".equals(role) && !"CHAIRPERSON".equalsIgnoreCase(inviterMembership.getRole())) {
            throw new org.springframework.security.access.AccessDeniedException("Only the chairperson can invite someone as an official");
        }
        Chama chama = chamaRepository.findById(chamaId).filter(c -> Boolean.TRUE.equals(c.getIsActive()))
                .orElseThrow(() -> new IllegalArgumentException("Chama not found"));
        User inviter = userRepository.findById(inviterUserId)
                .orElseThrow(() -> new IllegalArgumentException("Inviter user not found"));
        String email = dto.getEmail() == null || dto.getEmail().isBlank() ? null : dto.getEmail().trim().toLowerCase();
        String phone = dto.getPhone_number() == null || dto.getPhone_number().isBlank() ? null : dto.getPhone_number().trim();
        Invite invite = Invite.builder()
                .chama(chama)
                .invitedBy(inviter)
                .inviteCode(UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase())
                .email(email)
                .phoneNumber(phone)
                .role(role)
                .status("ACTIVE")
                .expiresAt(ZonedDateTime.now().plusDays(7))
                .build();
        return InviteDto.fromEntity(inviteRepository.save(invite));
    }

    @Transactional
    public InviteDto acceptInvite(String inviteCode, Long acceptingUserId) {
        log.info("Accepting an invite by user ID: {}", acceptingUserId);
        Invite invite = inviteRepository.findByInviteCode(inviteCode == null ? "" : inviteCode.trim().toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("This invitation code is not valid"));
        if (!"ACTIVE".equals(invite.getStatus()) || invite.getExpiresAt().isBefore(ZonedDateTime.now())) {
            throw new IllegalStateException("This invitation has expired or is no longer active");
        }
        if (!Boolean.TRUE.equals(invite.getChama().getIsActive())) {
            throw new IllegalStateException("This chama is no longer active");
        }
        User user = userRepository.findById(acceptingUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        // An invitation addressed to an email or phone number can only be used by that person.
        if (invite.getEmail() != null && (user.getEmail() == null || !invite.getEmail().equalsIgnoreCase(user.getEmail().trim()))) {
            throw new org.springframework.security.access.AccessDeniedException("This invitation was sent to a different email address");
        }
        if (invite.getPhoneNumber() != null && !invite.getPhoneNumber().equals(user.getPhoneNumber())) {
            throw new org.springframework.security.access.AccessDeniedException("This invitation was sent to a different phone number");
        }
        Long chamaId = invite.getChama().getChamaId();
        ChamaMember existing = chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, acceptingUserId).orElse(null);
        if (existing != null && Boolean.TRUE.equals(existing.getIsActive())) {
            throw new IllegalStateException("You are already a member of this chama");
        }
        String role = MembershipService.ASSIGNABLE_ROLES.contains(String.valueOf(invite.getRole()).toUpperCase()) ? invite.getRole().toUpperCase() : "MEMBER";
        if (existing == null) {
            chamaMemberRepository.save(ChamaMember.builder().chama(invite.getChama()).user(user).role(role).status("ACTIVE").isActive(true).build());
        } else {
            existing.setIsActive(true);
            existing.setStatus("ACTIVE");
            existing.setRole(role);
            chamaMemberRepository.save(existing);
        }
        invite.setStatus("ACCEPTED");
        invite.setAcceptedAt(ZonedDateTime.now());
        invite.setAcceptedBy(user);
        Invite updated = inviteRepository.save(invite);
        membershipService.syncMemberCount(invite.getChama());
        return InviteDto.fromEntity(updated);
    }

    @Transactional
    public JoinRequestDto createJoinRequest(JoinRequestDto dto, Long chamaId, Long requestingUserId) {
        log.info("Creating join request for chama ID: {} by user ID: {}", chamaId, requestingUserId);
        Chama chama = chamaRepository.findById(chamaId).filter(c -> Boolean.TRUE.equals(c.getIsActive()))
                .orElseThrow(() -> new IllegalArgumentException("Chama not found"));
        if (!"PUBLIC".equalsIgnoreCase(chama.getVisibility()) || (verification != null && !verification.isListed(chamaId))) {
            throw new org.springframework.security.access.AccessDeniedException("This chama is private. You need an invitation to join");
        }
        User user = userRepository.findById(requestingUserId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (chamaMemberRepository.existsByChamaChamaIdAndUserUserIdAndIsActiveTrue(chamaId, requestingUserId)) {
            throw new IllegalStateException("You are already a member of this chama");
        }
        if (joinRequestRepository.findAllByChamaChamaIdAndUserUserId(chamaId, requestingUserId).stream().anyMatch(r -> "PENDING".equals(r.getStatus()))) {
            throw new IllegalStateException("You already have a pending request for this chama");
        }
        String message = dto.getMessage();
        if (message != null && message.length() > 4000) throw new IllegalArgumentException("Your message is too long");
        JoinRequest saved = joinRequestRepository.save(JoinRequest.builder().chama(chama).user(user).message(message).status("PENDING").build());
        return JoinRequestDto.fromEntity(saved);
    }

    @Transactional
    public JoinRequestDto reviewJoinRequest(Long requestId, Long reviewerUserId, String decision, String comments) {
        log.info("Reviewing join request ID: {} by user ID: {}", requestId, reviewerUserId);
        JoinRequest request = joinRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Join request not found"));
        Long chamaId = request.getChama().getChamaId();
        membershipService.activeOfficial(chamaId, reviewerUserId);
        if (request.getUser().getUserId().equals(reviewerUserId)) {
            throw new org.springframework.security.access.AccessDeniedException("You cannot review your own request");
        }
        String verdict = decision == null ? "" : decision.trim().toUpperCase();
        if (!verdict.equals("APPROVED") && !verdict.equals("REJECTED")) throw new IllegalArgumentException("Decision must be APPROVED or REJECTED");
        if (!"PENDING".equals(request.getStatus())) throw new IllegalStateException("This request has already been reviewed");
        User reviewer = userRepository.findById(reviewerUserId).orElseThrow(() -> new IllegalArgumentException("Reviewer user not found"));
        request.setStatus(verdict);
        request.setReviewedAt(ZonedDateTime.now());
        request.setReviewedBy(reviewer);
        request.setReviewComments(comments);
        if (verdict.equals("APPROVED")) {
            ChamaMember existing = chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, request.getUser().getUserId()).orElse(null);
            if (existing == null) {
                chamaMemberRepository.save(ChamaMember.builder().chama(request.getChama()).user(request.getUser()).role("MEMBER").status("ACTIVE").isActive(true).build());
            } else if (!Boolean.TRUE.equals(existing.getIsActive())) {
                existing.setIsActive(true);
                existing.setStatus("ACTIVE");
                existing.setRole("MEMBER");
                chamaMemberRepository.save(existing);
            }
            membershipService.syncMemberCount(request.getChama());
        }
        String chamaName = request.getChama().getChamaName();
        notificationRepository.save(Notification.builder()
                .user(request.getUser())
                .title(verdict.equals("APPROVED") ? "Join Request Approved" : "Join Request Declined")
                .message(verdict.equals("APPROVED") ? "Your request to join " + chamaName + " has been approved."
                        : "Your request to join " + chamaName + " was declined." + (comments != null && !comments.isBlank() ? " Comments: " + comments : ""))
                .type(verdict.equals("APPROVED") ? "JOIN_APPROVED" : "JOIN_REJECTED")
                .entityType("CHAMA")
                .entityId(chamaId)
                .build());
        return JoinRequestDto.fromEntity(joinRequestRepository.save(request));
    }

    /** The signed-in user's own requests, with real statuses. */
    @Transactional(readOnly = true)
    public List<JoinRequestDto> getMyJoinRequests(Long userId) {
        return joinRequestRepository.findByUserUserId(userId).stream().map(JoinRequestDto::fromEntity).collect(Collectors.toList());
    }

    private Meeting meetingOf(Long chamaId, Long meetingId) {
        Meeting m = meetingRepository.findById(meetingId).orElseThrow(() -> new IllegalArgumentException("Meeting not found"));
        if (!m.getChama().getChamaId().equals(chamaId)) throw new IllegalArgumentException("Meeting not found");
        return m;
    }

    @Transactional(readOnly = true)
    public MeetingDto getMeeting(Long chamaId, Long meetingId, Long requesterUserId) {
        membershipService.activeMember(chamaId, requesterUserId);
        return MeetingDto.fromEntity(meetingOf(chamaId, meetingId));
    }

    @Transactional
    public MeetingDto updateMeeting(Long chamaId, Long meetingId, MeetingDto dto, Long requesterUserId) {
        membershipService.activeOfficial(chamaId, requesterUserId);
        Meeting m = meetingOf(chamaId, meetingId);
        if ("CANCELLED".equals(m.getStatus()) || "COMPLETED".equals(m.getStatus())) {
            throw new IllegalStateException("A " + m.getStatus().toLowerCase() + " meeting can't be changed");
        }
        if (dto.getTitle() != null) {
            if (dto.getTitle().isBlank()) throw new IllegalArgumentException("The meeting needs a title");
            m.setTitle(dto.getTitle().trim());
        }
        if (dto.getDescription() != null) m.setDescription(dto.getDescription());
        if (dto.getScheduled_date() != null) m.setScheduledDate(dto.getScheduled_date());
        if (dto.getLocation() != null) m.setLocation(dto.getLocation());
        if (dto.getMeeting_link() != null) m.setMeetingLink(com.chamasmart.backend.util.SafeUrl.https(dto.getMeeting_link(), "meeting"));
        if (dto.getAgenda() != null) m.setAgenda(dto.getAgenda());
        if (dto.getMinutes() != null) m.setMinutes(dto.getMinutes());
        return MeetingDto.fromEntity(meetingRepository.save(m));
    }

    /** Publishing the minutes closes the meeting. */
    @Transactional
    public MeetingDto publishMinutes(Long chamaId, Long meetingId, Long requesterUserId) {
        membershipService.activeOfficial(chamaId, requesterUserId);
        Meeting m = meetingOf(chamaId, meetingId);
        if ("CANCELLED".equals(m.getStatus())) throw new IllegalStateException("A cancelled meeting has no minutes");
        if (m.getMinutes() == null || m.getMinutes().isBlank()) throw new IllegalStateException("Write the minutes before publishing them");
        m.setStatus("COMPLETED");
        m.setRecordedBy(userRepository.findById(requesterUserId).orElseThrow(() -> new IllegalArgumentException("User not found")));
        return MeetingDto.fromEntity(meetingRepository.save(m));
    }

    /** Meetings are cancelled, not erased, so the record of what was scheduled stays. */
    @Transactional
    public MeetingDto cancelMeeting(Long chamaId, Long meetingId, Long requesterUserId) {
        membershipService.activeOfficial(chamaId, requesterUserId);
        Meeting m = meetingOf(chamaId, meetingId);
        if ("COMPLETED".equals(m.getStatus())) throw new IllegalStateException("A meeting with published minutes can't be cancelled");
        m.setStatus("CANCELLED");
        return MeetingDto.fromEntity(meetingRepository.save(m));
    }

    @Transactional(readOnly = true)
    public List<MeetingDto> getMeetingsByChamaId(Long chamaId, Long requesterUserId) {
        membershipService.activeMember(chamaId, requesterUserId);
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
    public List<InviteDto> getInvitesByChamaId(Long chamaId, String status, Long requesterUserId) {
        membershipService.activeOfficial(chamaId, requesterUserId);
        return inviteRepository.findByChamaChamaIdAndStatus(chamaId, status).stream()
                .map(InviteDto::fromEntity)
                .collect(Collectors.toList());
    }
    @Transactional(readOnly = true)
    public List<JoinRequestDto> getJoinRequestsByChamaId(Long chamaId, String status, Long requesterUserId) {
        membershipService.activeOfficial(chamaId, requesterUserId);
        return joinRequestRepository.findByChamaChamaIdAndStatus(chamaId, status).stream()
                .map(JoinRequestDto::fromEntity)
                .collect(Collectors.toList());
    }
    @Transactional
    public void deactivateInvite(Long inviteId, Long requesterUserId) {
        Invite invite = inviteRepository.findById(inviteId).orElseThrow(() -> new IllegalArgumentException("Invitation not found"));
        membershipService.activeOfficial(invite.getChama().getChamaId(), requesterUserId);
        if (!"ACTIVE".equals(invite.getStatus())) throw new IllegalStateException("This invitation is no longer active");
        invite.setStatus("REVOKED");
        inviteRepository.save(invite);
    }
}
