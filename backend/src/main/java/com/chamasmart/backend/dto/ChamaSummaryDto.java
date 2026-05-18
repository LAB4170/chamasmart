package com.chamasmart.backend.dto;

import com.chamasmart.backend.domain.Chama;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonAlias;
import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChamaSummaryDto {
    @JsonProperty("chama_id")
    @JsonAlias({"chamaId", "chama_id"})
    private Long chama_id;

    @JsonProperty("chama_name")
    @JsonAlias({"chamaName", "chama_name"})
    private String chama_name;

    @JsonProperty("chama_type")
    @JsonAlias({"chamaType", "chama_type"})
    private String chama_type;

    private String description;

    @JsonProperty("contribution_amount")
    @JsonAlias({"contributionAmount", "contribution_amount"})
    private BigDecimal contribution_amount;

    @JsonProperty("contribution_frequency")
    @JsonAlias({"contributionFrequency", "contribution_frequency"})
    private String contribution_frequency;

    @JsonProperty("current_fund")
    @JsonAlias({"currentFund", "current_fund"})
    private BigDecimal current_fund;

    @JsonProperty("total_members")
    @JsonAlias({"totalMembers", "total_members"})
    private Integer total_members;

    private String visibility;

    @JsonProperty("is_active")
    @JsonAlias({"isActive", "is_active"})
    private Boolean is_active;

    @JsonProperty("created_at")
    @JsonAlias({"createdAt", "created_at"})
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
