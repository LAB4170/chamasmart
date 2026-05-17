package com.chamasmart.backend.dto;

import com.chamasmart.backend.domain.WelfareConfig;
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
public class WelfareConfigDto {
    private Long config_id;
    private Long chama_id;
    private String event_type;
    private String description;
    private BigDecimal payout_amount;
    private String contribution_type;
    private BigDecimal contribution_amount;
    private Boolean is_active;
    private ZonedDateTime created_at;

    public static WelfareConfigDto fromEntity(WelfareConfig wc) {
        return WelfareConfigDto.builder()
                .config_id(wc.getConfigId())
                .chama_id(wc.getChama().getChamaId())
                .event_type(wc.getEventType())
                .description(wc.getDescription())
                .payout_amount(wc.getPayoutAmount())
                .contribution_type(wc.getContributionType())
                .contribution_amount(wc.getContributionAmount())
                .is_active(wc.getIsActive())
                .created_at(wc.getCreatedAt())
                .build();
    }
}
