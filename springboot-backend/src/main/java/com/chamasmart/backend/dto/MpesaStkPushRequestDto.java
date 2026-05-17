package com.chamasmart.backend.dto;

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
    private Long chama_id;
    private BigDecimal amount;
    private String phone_number;
    private String contribution_type; // REGULAR, PENALTY, WELFARE
}
