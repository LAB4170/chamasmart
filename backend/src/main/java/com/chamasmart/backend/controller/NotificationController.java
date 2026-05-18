package com.chamasmart.backend.controller;

import com.chamasmart.backend.domain.Notification;
import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.dto.NotificationDto;
import com.chamasmart.backend.repository.NotificationRepository;
import com.chamasmart.backend.security.CustomUserDetails;
import com.chamasmart.backend.service.GovernanceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final GovernanceService governanceService;
    private final NotificationRepository notificationRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<NotificationDto>>> getAllNotifications(
            @RequestParam(required = false) Integer limit,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to get all notifications for user ID: {} with limit: {}", currentUser.getUserId(), limit);
        List<NotificationDto> notifications = governanceService.getMyNotifications(currentUser.getUserId());
        if (limit != null && limit > 0 && notifications.size() > limit) {
            notifications = notifications.subList(0, limit);
        }
        return ResponseEntity.ok(ApiResponse.success(notifications, "Notifications retrieved successfully"));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getUnreadCount(
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to get unread notification count for user ID: {}", currentUser.getUserId());
        List<Notification> unread = notificationRepository.findByUserUserIdAndIsReadFalse(currentUser.getUserId());
        
        Map<String, Object> responseData = new HashMap<>();
        responseData.put("unreadCount", unread.size());
        
        return ResponseEntity.ok(ApiResponse.success(responseData, "Unread count retrieved successfully"));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<ApiResponse<Void>> markAsRead(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to mark notification ID: {} as read by user ID: {}", id, currentUser.getUserId());
        governanceService.markNotificationAsRead(id, currentUser.getUserId());
        return ResponseEntity.ok(ApiResponse.success(null, "Notification marked as read"));
    }

    @PutMapping("/read-all")
    public ResponseEntity<ApiResponse<Void>> markAllAsRead(
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to mark all notifications as read for user ID: {}", currentUser.getUserId());
        List<Notification> unread = notificationRepository.findByUserUserIdAndIsReadFalse(currentUser.getUserId());
        for (Notification n : unread) {
            n.setIsRead(true);
            n.setReadAt(ZonedDateTime.now());
        }
        notificationRepository.saveAll(unread);
        return ResponseEntity.ok(ApiResponse.success(null, "All notifications marked as read"));
    }
}
