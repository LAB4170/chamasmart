package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Entity
@Table(name = "contributions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Contribution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "contribution_id")
    private Long contributionId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chama_id", nullable = false)
    private Chama chama;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @CreationTimestamp
    @Column(name = "contribution_date", updatable = false)
    private ZonedDateTime contributionDate;

    @Column(name = "contribution_type", length = 20)
    @Builder.Default
    private String contributionType = "REGULAR";

    @Column(length = 100)
    private String reference;

    @Column(length = 20)
    @Builder.Default
    private String status = "COMPLETED"; // PENDING, COMPLETED, FAILED

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;

    @Column(name = "payment_proof", length = 500)
    private String paymentProof;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "is_deleted")
    @Builder.Default
    private Boolean isDeleted = false;

    @Column(name = "deleted_at")
    private ZonedDateTime deletedAt;

    @Column(name = "cycle_id")
    private Long cycleId;

    @Column(name = "installment_number")
    private Integer installmentNumber;
}
