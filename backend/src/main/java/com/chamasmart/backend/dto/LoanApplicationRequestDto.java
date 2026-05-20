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
    @com.fasterxml.jackson.annotation.JsonAlias({"chama_id", "chamaId"})
    private Long chama_id;

    @com.fasterxml.jackson.annotation.JsonAlias({"loan_amount", "amount"})
    private BigDecimal loan_amount;

    @com.fasterxml.jackson.annotation.JsonAlias({"term_months", "repaymentPeriodMonths", "repaymentPeriod"})
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
        @com.fasterxml.jackson.annotation.JsonAlias({"user_id", "guarantorId"})
        private Long user_id;

        @com.fasterxml.jackson.annotation.JsonAlias({"guarantee_amount", "amount"})
        private BigDecimal guarantee_amount;
    }
}
