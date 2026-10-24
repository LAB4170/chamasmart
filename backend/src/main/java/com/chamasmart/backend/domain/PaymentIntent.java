package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.ZonedDateTime;

/**
 * One member's intention to pay one chama, from "I want to pay" to "an official verified it". The intent never credits anything:
 * crediting stays with the verified contribution it creates, so every payment still passes the existing checks.
 * (user, idempotency key) is unique, so a retried request cannot create a second intent.
 */
@Entity
@Table(name = "payment_intents", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "idempotency_key"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentIntent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "intent_id")
    private Long intentId;

    @Column(name = "chama_id", nullable = false)
    private Long chamaId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    /** CONTRIBUTION, FINE or WELFARE. */
    @Column(nullable = false, length = 20)
    private String purpose;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 20)
    private String provider;

    /** AWAITING_PAYMENT, SUBMITTED, CANCELLED or EXPIRED stored; CONFIRMED and FAILED are read from the linked contribution. */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "AWAITING_PAYMENT";

    @Column(name = "idempotency_key", nullable = false, length = 64)
    private String idempotencyKey;

    @Column(name = "contribution_id")
    private Long contributionId;

    @Column(name = "expires_at", nullable = false)
    private ZonedDateTime expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;
}
