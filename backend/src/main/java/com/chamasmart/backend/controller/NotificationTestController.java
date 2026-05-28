package com.chamasmart.backend.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import lombok.AllArgsConstructor;
import lombok.Data;

@RestController
@AllArgsConstructor
public class NotificationTestController {
    private static final Logger log = LoggerFactory.getLogger(NotificationTestController.class);

    private final SimpMessagingTemplate messagingTemplate;

    @Data
    public static class TestMessage {
        private String content;
    }

    // Simple HTTP endpoint to trigger a notification (useful for manual testing)
    @PostMapping("/api/v1/test/notify")
    public void sendTestNotification(@RequestBody TestMessage message) {
        // Broadcast to all subscribed clients on the STOMP topic
        messagingTemplate.convertAndSend("/topic/new_notification", message);
    }

    // STOMP endpoint (if you want to accept messages from clients)
    @MessageMapping("new_notification")
    @SendTo("/topic/new_notification")
    public TestMessage echo(TestMessage message) {
        return message;
    }
}


