package com.chamasmart.backend.dto;

import com.chamasmart.backend.domain.Invite;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.ZonedDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InviteDto {
    private Long invite_id;
    private Long chama_id;
    private String chama_name;
    private String invited_by_name;
    private String invite_code;
    private String email;
    private String phone_number;
    private String role;
    private String status;
    private ZonedDateTime expires_at;
    private ZonedDateTime created_at;
    private ZonedDateTime accepted_at;
    private String accepted_by_name;

    public static InviteDto fromEntity(Invite i) {
        return InviteDto.builder()
                .invite_id(i.getInviteId())
                .chama_id(i.getChama().getChamaId())
                .chama_name(i.getChama().getChamaName())
                .invited_by_name(i.getInvitedBy().getFirstName() + " " + i.getInvitedBy().getLastName())
                .invite_code(i.getInviteCode())
                .email(i.getEmail())
                .phone_number(i.getPhoneNumber())
                .role(i.getRole())
                .status(i.getStatus())
                .expires_at(i.getExpiresAt())
                .created_at(i.getCreatedAt())
                .accepted_at(i.getAcceptedAt())
                .accepted_by_name(i.getAcceptedBy() != null ? i.getAcceptedBy().getFirstName() + " " + i.getAcceptedBy().getLastName() : null)
                .build();
    }
}
