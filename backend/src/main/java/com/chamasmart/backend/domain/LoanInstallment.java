package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/** T-04: one stored instalment of a loan. Payments are applied to it in a fixed order: fees, then interest, then principal. */
@Entity
@Table(name = "loan_installments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoanInstallment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "installment_id")
    private Long installmentId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "loan_id", nullable = false)
    private Loan loan;

    @Column(name = "installment_number", nullable = false)
    private Integer number;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal principal;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal interest;

    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal fee = BigDecimal.ZERO;

    @Column(name = "paid_principal", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal paidPrincipal = BigDecimal.ZERO;

    @Column(name = "paid_interest", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal paidInterest = BigDecimal.ZERO;

    @Column(name = "paid_fee", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal paidFee = BigDecimal.ZERO;

    @Column(name = "fee_applied", nullable = false)
    @Builder.Default
    private Boolean feeApplied = false;

    public BigDecimal due() { return principal.add(interest).add(fee); }
    public BigDecimal paid() { return paidPrincipal.add(paidInterest).add(paidFee); }
    public BigDecimal unpaid() { return due().subtract(paid()).max(BigDecimal.ZERO); }
}
