package com.chamasmart.backend.controller;

import com.chamasmart.backend.domain.User;
import com.chamasmart.backend.dto.ApiResponse;
import com.chamasmart.backend.repository.UserRepository;
import com.chamasmart.backend.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.ZonedDateTime;
import java.util.*;

@Slf4j
@RestController
@RequestMapping("/chat")
@RequiredArgsConstructor
public class ChatController {

    private final UserRepository userRepository;

    /** GET /chat/chamas/{chamaId}/channels */
    @GetMapping("/chamas/{chamaId}/channels")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getChannels(@PathVariable Long chamaId) {
        log.info("REST request to get chat channels for chama ID: {}", chamaId);
        
        Map<String, Object> channel = new HashMap<>();
        channel.put("channel_id", 999900L + chamaId);
        channel.put("channel_name", "General Chat");
        channel.put("chama_id", chamaId);
        
        List<Map<String, Object>> list = Collections.singletonList(channel);
        return ResponseEntity.ok(ApiResponse.success(list, "Channels retrieved successfully"));
    }

    /** GET /chat/channels/{channelId}/messages */
    @GetMapping("/channels/{channelId}/messages")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getMessages(
            @PathVariable Long channelId,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int limit) {
        log.info("REST request to get chat messages for channel ID: {}, page: {}, limit: {}", channelId, page, limit);
        
        List<Map<String, Object>> messages = new ArrayList<>();
        
        Map<String, Object> systemMsg = new HashMap<>();
        systemMsg.put("message_id", 1L);
        systemMsg.put("user_id", null);
        systemMsg.put("message_type", "system");
        systemMsg.put("content", "Welcome to the group chat! Start contributing or send a message to your group members.");
        systemMsg.put("created_at", ZonedDateTime.now().minusDays(1).toString());
        messages.add(systemMsg);
        
        return ResponseEntity.ok(ApiResponse.success(messages, "Messages retrieved successfully"));
    }

    /** POST /chat/channels/{channelId}/messages */
    @PostMapping("/channels/{channelId}/messages")
    public ResponseEntity<ApiResponse<Map<String, Object>>> sendMessage(
            @PathVariable Long channelId,
            @RequestBody Map<String, Object> payload,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("REST request to send chat message to channel ID: {} by user ID: {}", channelId, currentUser.getUserId());
        
        User user = userRepository.findById(currentUser.getUserId())
                .orElseThrow(() -> new RuntimeException("Logged in user not found"));

        Map<String, Object> msg = new HashMap<>();
        msg.put("message_id", System.currentTimeMillis());
        msg.put("user_id", user.getUserId());
        msg.put("message_type", payload.getOrDefault("messageType", "text"));
        msg.put("content", payload.get("content"));
        msg.put("media_url", payload.get("mediaUrl"));
        msg.put("first_name", user.getFirstName());
        msg.put("last_name", user.getLastName());
        msg.put("created_at", ZonedDateTime.now().toString());

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(msg, "Message sent successfully"));
    }
}
