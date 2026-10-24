package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.ZonedDateTime;

/** A claim on the loan cover reserve after the borrower's death or permanent disability. Needs two different officials. */
@Entity
@Table(name = "loan_cover_claims")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoanCoverClaim {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "claim_id")
    private Long claimId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "loan_id", nullable = false)
    private Loan loan;

    @Column(name = "chama_id", nullable = false)
    private Long chamaId;

    /** DEATH or DISABILITY. */
    @Column(nullable = false, length = 20)
    private String reason;

    @Column(length = 500)
    private String details;

    /** PENDING, APPROVED, REJECTED. */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "requested_by", nullable = false)
    private Long requestedBy;

    @Column(name = "decided_by")
    private Long decidedBy;

    @Column(name = "decision_note", length = 300)
    private String decisionNote;

    @Column(name = "amount_paid", precision = 15, scale = 2)
    private BigDecimal amountPaid;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;

    @Column(name = "decided_at")
    private ZonedDateTime decidedAt;
}
