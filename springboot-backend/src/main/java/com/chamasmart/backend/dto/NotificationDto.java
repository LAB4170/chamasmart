package com.chamasmart.backend.dto;

import com.chamasmart.backend.domain.Notification;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.ZonedDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationDto {
    private Long notification_id;
    private Long user_id;
    private String title;
    private String message;
    private String type;
    private Boolean is_read;
    private ZonedDateTime read_at;
    private ZonedDateTime created_at;
    private String metadata;
    private String entity_type;
    private Long entity_id;

    public static NotificationDto fromEntity(Notification n) {
        return NotificationDto.builder()
                .notification_id(n.getNotificationId())
                .user_id(n.getUser().getUserId())
                .title(n.getTitle())
                .message(n.getMessage())
                .type(n.getType())
                .is_read(n.getIsRead())
                .read_at(n.getReadAt())
                .created_at(n.getCreatedAt())
                .metadata(n.getMetadata())
                .entity_type(n.getEntityType())
                .entity_id(n.getEntityId())
                .build();
    }
}
