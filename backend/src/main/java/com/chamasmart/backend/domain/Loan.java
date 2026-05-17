package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "loans")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Loan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "loan_id")
    private Long loanId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chama_id", nullable = false)
    private Chama chama;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "borrower_id", nullable = false)
    private User borrower;

    @Column(name = "loan_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal loanAmount;

    @Column(name = "approved_amount", precision = 15, scale = 2)
    private BigDecimal approvedAmount;

    @Column(name = "interest_rate", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal interestRate = BigDecimal.valueOf(10.0);

    @Column(name = "term_months", nullable = false)
    private Integer termMonths;

    @Column(columnDefinition = "TEXT")
    private String purpose;

    @Column(length = 20)
    @Builder.Default
    private String status = "PENDING"; // PENDING, APPROVED, DISBURSED, REJECTED, COMPLETED, DEFAULTED

    @Column(name = "total_repayable", precision = 15, scale = 2)
    private BigDecimal totalRepayable;

    @Column(name = "amount_paid", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal amountPaid = BigDecimal.ZERO;

    @Column(precision = 15, scale = 2, insertable = false, updatable = false)
    private BigDecimal balance;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;

    @Column(name = "approved_at")
    private ZonedDateTime approvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private User approvedBy;

    @Column(name = "rejected_at")
    private ZonedDateTime rejectedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rejected_by")
    private User rejectedBy;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "approval_notes", columnDefinition = "TEXT")
    private String approvalNotes;

    @Column(name = "last_payment_date")
    private ZonedDateTime lastPaymentDate;

    @Column(name = "guarantor_required")
    @Builder.Default
    private Boolean guarantorRequired = false;

    @Column(name = "collateral_description", columnDefinition = "TEXT")
    private String collateralDescription;

    @Column(name = "monthly_payment", precision = 15, scale = 2)
    private BigDecimal monthlyPayment;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @OneToMany(mappedBy = "loan", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<LoanGuarantor> guarantors = new ArrayList<>();

    @Version
    @Column(name = "version")
    private Long version;
}
