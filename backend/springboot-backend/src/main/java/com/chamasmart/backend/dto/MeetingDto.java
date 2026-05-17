package com.chamasmart.backend.dto;

import com.chamasmart.backend.domain.Meeting;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MeetingDto {
    private Long meeting_id;
    private Long chama_id;
    private String title;
    private String description;
    private ZonedDateTime scheduled_date;
    private String location;
    private String meeting_type;
    private String status;
    private String created_by_name;
    private String agenda;
    private String minutes;
    private BigDecimal total_collected;
    private String recorded_by_name;
    private String meeting_link;
    private ZonedDateTime created_at;

    public static MeetingDto fromEntity(Meeting m) {
        return MeetingDto.builder()
                .meeting_id(m.getMeetingId())
                .chama_id(m.getChama().getChamaId())
                .title(m.getTitle())
                .description(m.getDescription())
                .scheduled_date(m.getScheduledDate())
                .location(m.getLocation())
                .meeting_type(m.getMeetingType())
                .status(m.getStatus())
                .created_by_name(m.getCreatedBy().getFirstName() + " " + m.getCreatedBy().getLastName())
                .agenda(m.getAgenda())
                .minutes(m.getMinutes())
                .total_collected(m.getTotalCollected())
                .recorded_by_name(m.getRecordedBy() != null ? m.getRecordedBy().getFirstName() + " " + m.getRecordedBy().getLastName() : null)
                .meeting_link(m.getMeetingLink())
                .created_at(m.getCreatedAt())
                .build();
    }
}
