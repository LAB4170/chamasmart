package com.chamasmart.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WelfareClaimRequestDto {
    private Long chama_id;
    private Long event_type_id;
    private String custom_event_name;
    private BigDecimal claim_amount;
    private String description;
    private LocalDate date_of_occurrence;
    private String proof_document_url;
}
