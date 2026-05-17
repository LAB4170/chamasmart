package com.chamasmart.backend.dto;

import com.chamasmart.backend.domain.Loan;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZonedDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoanSummaryDto {
    private Long loan_id;
    private Long chama_id;
    private String chama_name;
    private Long borrower_id;
    private String borrower_name;
    private BigDecimal loan_amount;
    private BigDecimal approved_amount;
    private BigDecimal interest_rate;
    private Integer term_months;
    private String purpose;
    private String status;
    private BigDecimal total_repayable;
    private BigDecimal amount_paid;
    private BigDecimal balance;
    private BigDecimal monthly_payment;
    private LocalDate due_date;
    private ZonedDateTime created_at;

    public static LoanSummaryDto fromEntity(Loan loan) {
        BigDecimal calcBalance = loan.getTotalRepayable() != null 
                ? loan.getTotalRepayable().subtract(loan.getAmountPaid() != null ? loan.getAmountPaid() : BigDecimal.ZERO) 
                : (loan.getLoanAmount() != null ? loan.getLoanAmount() : BigDecimal.ZERO);

        return LoanSummaryDto.builder()
                .loan_id(loan.getLoanId())
                .chama_id(loan.getChama().getChamaId())
                .chama_name(loan.getChama().getChamaName())
                .borrower_id(loan.getBorrower().getUserId())
                .borrower_name(loan.getBorrower().getFirstName() + " " + loan.getBorrower().getLastName())
                .loan_amount(loan.getLoanAmount())
                .approved_amount(loan.getApprovedAmount())
                .interest_rate(loan.getInterestRate())
                .term_months(loan.getTermMonths())
                .purpose(loan.getPurpose())
                .status(loan.getStatus())
                .total_repayable(loan.getTotalRepayable())
                .amount_paid(loan.getAmountPaid())
                .balance(calcBalance)
                .monthly_payment(loan.getMonthlyPayment())
                .due_date(loan.getDueDate())
                .created_at(loan.getCreatedAt())
                .build();
    }
}
