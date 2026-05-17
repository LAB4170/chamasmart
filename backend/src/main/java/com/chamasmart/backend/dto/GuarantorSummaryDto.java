package com.chamasmart.backend.dto;

import com.chamasmart.backend.domain.LoanGuarantor;
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
public class GuarantorSummaryDto {
    private Long guarantor_id;
    private Long loan_id;
    private Long chama_id;
    private String chama_name;
    private Long borrower_id;
    private String borrower_name;
    private BigDecimal loan_amount;
    private Integer term_months;
    private String purpose;
    private BigDecimal guarantee_amount;
    private String guarantee_status;
    private ZonedDateTime created_at;

    public static GuarantorSummaryDto fromEntity(LoanGuarantor lg) {
        return GuarantorSummaryDto.builder()
                .guarantor_id(lg.getGuarantorId())
                .loan_id(lg.getLoan().getLoanId())
                .chama_id(lg.getLoan().getChama().getChamaId())
                .chama_name(lg.getLoan().getChama().getChamaName())
                .borrower_id(lg.getLoan().getBorrower().getUserId())
                .borrower_name(lg.getLoan().getBorrower().getFirstName() + " " + lg.getLoan().getBorrower().getLastName())
                .loan_amount(lg.getLoan().getLoanAmount())
                .term_months(lg.getLoan().getTermMonths())
                .purpose(lg.getLoan().getPurpose())
                .guarantee_amount(lg.getGuaranteeAmount())
                .guarantee_status(lg.getStatus())
                .created_at(lg.getCreatedAt())
                .build();
    }
}
