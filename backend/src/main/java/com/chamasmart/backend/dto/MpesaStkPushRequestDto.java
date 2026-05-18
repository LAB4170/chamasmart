package com.chamasmart.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MpesaStkPushRequestDto {
    @JsonProperty("chamaId")
    private Long chamaId;

    private BigDecimal amount;

    @JsonProperty("phoneNumber")
    private String phoneNumber;

    @JsonProperty("contributionType")
    private String contributionType;
}
