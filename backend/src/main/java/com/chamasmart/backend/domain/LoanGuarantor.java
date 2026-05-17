package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Entity
@Table(name = "loan_guarantors", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"loan_id", "guarantor_user_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoanGuarantor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "guarantor_id")
    private Long guarantorId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "loan_id", nullable = false)
    private Loan loan;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "guarantor_user_id", nullable = false)
    private User guarantorUser;

    @Column(name = "guarantee_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal guaranteeAmount;

    @Column(length = 20)
    @Builder.Default
    private String status = "PENDING"; // PENDING, APPROVED, REJECTED

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;

    @Column(name = "approved_at")
    private ZonedDateTime approvedAt;
}
