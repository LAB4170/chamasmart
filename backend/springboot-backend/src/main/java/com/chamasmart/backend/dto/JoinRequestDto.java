package com.chamasmart.backend.dto;

import com.chamasmart.backend.domain.JoinRequest;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.ZonedDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JoinRequestDto {
    private Long request_id;
    private Long chama_id;
    private String chama_name;
    private Long user_id;
    private String member_name;
    private String message;
    private String status;
    private ZonedDateTime created_at;
    private ZonedDateTime reviewed_at;
    private String reviewed_by_name;
    private String review_comments;

    public static JoinRequestDto fromEntity(JoinRequest jr) {
        return JoinRequestDto.builder()
                .request_id(jr.getRequestId())
                .chama_id(jr.getChama().getChamaId())
                .chama_name(jr.getChama().getChamaName())
                .user_id(jr.getUser().getUserId())
                .member_name(jr.getUser().getFirstName() + " " + jr.getUser().getLastName())
                .message(jr.getMessage())
                .status(jr.getStatus())
                .created_at(jr.getCreatedAt())
                .reviewed_at(jr.getReviewedAt())
                .reviewed_by_name(jr.getReviewedBy() != null ? jr.getReviewedBy().getFirstName() + " " + jr.getReviewedBy().getLastName() : null)
                .review_comments(jr.getReviewComments())
                .build();
    }
}
