package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.ZonedDateTime;

/** A request to spend chama money. REQUESTED, APPROVED, PAID, REJECTED, CANCELLED or EXPIRED. Nothing leaves the fund until PAID. */
@Entity
@Table(name = "payouts", uniqueConstraints = @UniqueConstraint(columnNames = {"requested_by", "idempotency_key"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Payout {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "payout_id") private Long payoutId;
    @Column(name = "chama_id", nullable = false) private Long chamaId;
    @Column(nullable = false, length = 20) @Builder.Default private String purpose = "EXPENSE";
    @Column(nullable = false, precision = 15, scale = 2) private BigDecimal amount;
    @Column(name = "payee_name", nullable = false, length = 100) private String payeeName;
    @Column(name = "payee_phone", length = 15) private String payeePhone;
    @Column(nullable = false, length = 300) private String reason;
    @Column(nullable = false, length = 20) private String status;
    @Column(name = "required_approvals", nullable = false) private Integer requiredApprovals;
    @Column(name = "requested_by", nullable = false) private Long requestedBy;
    @Column(name = "idempotency_key", nullable = false, length = 64) private String idempotencyKey;
    @Column(name = "release_at") private ZonedDateTime releaseAt;
    @Column(name = "paid_by") private Long paidBy;
    @Column(name = "paid_at") private ZonedDateTime paidAt;
    @Column(name = "payment_reference", length = 40) private String paymentReference;
    @Column(name = "decision_note", length = 300) private String decisionNote;
    @Column(name = "created_at", nullable = false) @Builder.Default private ZonedDateTime createdAt = ZonedDateTime.now();
}
