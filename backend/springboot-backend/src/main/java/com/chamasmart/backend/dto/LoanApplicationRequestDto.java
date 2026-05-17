package com.chamasmart.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoanApplicationRequestDto {
    private Long chama_id;
    private BigDecimal loan_amount;
    private Integer term_months;
    private String purpose;
    private List<GuarantorPledgeDto> guarantors;
    private Boolean guarantor_required;
    private String collateral_description;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GuarantorPledgeDto {
        private Long user_id;
        private BigDecimal guarantee_amount;
    }
}
