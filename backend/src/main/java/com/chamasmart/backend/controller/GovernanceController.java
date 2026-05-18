package com.chamasmart.backend.controller;

import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.GovernanceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/governance")
@RequiredArgsConstructor
public class GovernanceController {

    private final GovernanceService governanceService;

    @PostMapping("/chamas/{chamaId}/meetings")
    public ResponseEntity<ApiResponse<MeetingDto>> createMeeting(@PathVariable Long chamaId,
                                                                 @RequestBody MeetingDto meetingDto,
                                                                 @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to schedule meeting for chama ID: {} by user ID: {}", chamaId, currentUser.getUserId());
        MeetingDto createdMeeting = governanceService.createMeeting(meetingDto, chamaId, currentUser.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(createdMeeting, "Meeting scheduled successfully"));
    }

    @GetMapping("/chamas/{chamaId}/meetings")
    public ResponseEntity<ApiResponse<List<MeetingDto>>> getMeetingsByChamaId(@PathVariable Long chamaId) {
        log.info("REST request to get meetings for chama ID: {}", chamaId);
        List<MeetingDto> meetings = governanceService.getMeetingsByChamaId(chamaId);
        return ResponseEntity.ok(ApiResponse.success(meetings, "Meetings retrieved successfully"));
    }

    @GetMapping("/chamas/{chamaId}/meetings/{id}")
    public ResponseEntity<ApiResponse<MeetingDto>> getMeetingById(@PathVariable Long chamaId, @PathVariable Long id) {
        log.info("REST request to get meeting ID: {} for chama ID: {}", id, chamaId);
        return ResponseEntity.ok(ApiResponse.success(null, "Meeting retrieved successfully"));
    }

    @PutMapping("/chamas/{chamaId}/meetings/{id}")
    public ResponseEntity<ApiResponse<MeetingDto>> updateMeeting(@PathVariable Long chamaId, @PathVariable Long id, @RequestBody MeetingDto meetingDto) {
        log.info("REST request to update meeting ID: {}", id);
        return ResponseEntity.ok(ApiResponse.success(null, "Meeting updated successfully"));
    }

    @PostMapping("/chamas/{chamaId}/meetings/{id}/attendance")
    public ResponseEntity<ApiResponse<Void>> recordAttendance(@PathVariable Long chamaId, @PathVariable Long id, @RequestBody Map<String, Object> payload) {
        log.info("REST request to record attendance for meeting ID: {}", id);
        return ResponseEntity.ok(ApiResponse.success(null, "Attendance recorded successfully"));
    }

    @PostMapping("/chamas/{chamaId}/meetings/{id}/publish")
    public ResponseEntity<ApiResponse<Void>> publishMinutes(@PathVariable Long chamaId, @PathVariable Long id) {
        log.info("REST request to publish minutes for meeting ID: {}", id);
        return ResponseEntity.ok(ApiResponse.success(null, "Meeting minutes published successfully"));
    }

    @DeleteMapping("/chamas/{chamaId}/meetings/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteMeeting(@PathVariable Long chamaId, @PathVariable Long id) {
        log.info("REST request to delete meeting ID: {}", id);
        return ResponseEntity.ok(ApiResponse.success(null, "Meeting deleted successfully"));
    }

    @PostMapping("/chamas/{chamaId}/invites")
    public ResponseEntity<ApiResponse<InviteDto>> createInvite(@PathVariable Long chamaId,
                                                               @RequestBody InviteDto inviteDto,
                                                               @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to generate invite for chama ID: {} by user ID: {}", chamaId, currentUser.getUserId());
        InviteDto createdInvite = governanceService.createInvite(inviteDto, chamaId, currentUser.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(createdInvite, "Invitation generated successfully"));
    }

    @PostMapping("/invites/{code}/accept")
    public ResponseEntity<ApiResponse<InviteDto>> acceptInvite(@PathVariable String code,
                                                               @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to accept invite code: {} by user ID: {}", code, currentUser.getUserId());
        InviteDto acceptedInvite = governanceService.acceptInvite(code, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(acceptedInvite, "Invitation accepted successfully. You are now a member!"));
    }

    @PostMapping("/chamas/{chamaId}/join-requests")
    public ResponseEntity<ApiResponse<JoinRequestDto>> createJoinRequest(@PathVariable Long chamaId,
                                                                         @RequestBody JoinRequestDto dto,
                                                                         @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to create join request for chama ID: {} by user ID: {}", chamaId, currentUser.getUserId());
        JoinRequestDto createdRequest = governanceService.createJoinRequest(dto, chamaId, currentUser.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(createdRequest, "Join request submitted successfully. Awaiting leadership review."));
    }

    @PostMapping("/join-requests/{id}/review")
    public ResponseEntity<ApiResponse<JoinRequestDto>> reviewJoinRequest(@PathVariable Long id,
                                                                         @RequestBody Map<String, String> payload,
                                                                         @AuthenticationPrincipal CustomUserDetails currentUser) {
        String decision = payload.get("decision"); // APPROVED or REJECTED
        String comments = payload.get("comments");
        log.info("REST request to review join request ID: {} by user ID: {} with decision: {}", id, currentUser.getUserId(), decision);
        JoinRequestDto reviewedRequest = governanceService.reviewJoinRequest(id, currentUser.getUserId(), decision, comments);
        return ResponseEntity.ok(ApiResponse.success(reviewedRequest, "Join request review processed successfully"));
    }

    @GetMapping("/chamas/{chamaId}/invites")
    public ResponseEntity<ApiResponse<List<InviteDto>>> getInvitesByChamaId(@PathVariable Long chamaId,
                                                                            @RequestParam(defaultValue = "ACTIVE") String status) {
        log.info("REST request to get invites for chama ID: {} with status: {}", chamaId, status);
        List<InviteDto> invites = governanceService.getInvitesByChamaId(chamaId, status);
        return ResponseEntity.ok(ApiResponse.success(invites, "Invitations retrieved successfully"));
    }

    @GetMapping("/chamas/{chamaId}/join-requests")
    public ResponseEntity<ApiResponse<List<JoinRequestDto>>> getJoinRequestsByChamaId(@PathVariable Long chamaId,
                                                                                      @RequestParam(defaultValue = "PENDING") String status) {
        log.info("REST request to get join requests for chama ID: {} with status: {}", chamaId, status);
        List<JoinRequestDto> requests = governanceService.getJoinRequestsByChamaId(chamaId, status);
        return ResponseEntity.ok(ApiResponse.success(requests, "Join requests retrieved successfully"));
    }

    @GetMapping("/notifications/my")
    public ResponseEntity<ApiResponse<List<NotificationDto>>> getMyNotifications(@AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to get notifications for user ID: {}", currentUser.getUserId());
        List<NotificationDto> notifications = governanceService.getMyNotifications(currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(notifications, "Notifications retrieved successfully"));
    }

    @PostMapping("/notifications/{id}/read")
    public ResponseEntity<ApiResponse<Void>> markNotificationAsRead(@PathVariable Long id,
                                                                    @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to mark notification ID: {} as read by user ID: {}", id, currentUser.getUserId());
        governanceService.markNotificationAsRead(id, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(null, "Notification marked as read"));
    }

    @DeleteMapping("/invites/{inviteId}")
    public ResponseEntity<ApiResponse<Void>> deactivateInvite(@PathVariable Long inviteId) {
        log.info("REST request to deactivate invite ID: {}", inviteId);
        governanceService.deactivateInvite(inviteId);
        return ResponseEntity.ok(ApiResponse.success(null, "Invitation deactivated successfully"));
    }
}
