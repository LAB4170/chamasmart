package com.chamasmart.backend.dto;

import com.chamasmart.backend.domain.Chama;
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
public class ChamaSummaryDto {
    private Long chama_id;
    private String chama_name;
    private String chama_type;
    private String description;
    private BigDecimal contribution_amount;
    private String contribution_frequency;
    private BigDecimal current_fund;
    private Integer total_members;
    private String visibility;
    private Boolean is_active;
    private ZonedDateTime created_at;

    public static ChamaSummaryDto fromEntity(Chama chama) {
        return ChamaSummaryDto.builder()
                .chama_id(chama.getChamaId())
                .chama_name(chama.getChamaName())
                .chama_type(chama.getChamaType())
                .description(chama.getDescription())
                .contribution_amount(chama.getContributionAmount())
                .contribution_frequency(chama.getContributionFrequency())
                .current_fund(chama.getCurrentFund())
                .total_members(chama.getTotalMembers())
                .visibility(chama.getVisibility())
                .is_active(chama.getIsActive())
                .created_at(chama.getCreatedAt())
                .build();
    }
}
