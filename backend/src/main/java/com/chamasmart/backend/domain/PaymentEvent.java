package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.ZonedDateTime;

/** One thing a payment provider told us. (provider, provider event id) is unique, so a retried webhook is recognised and does nothing. */
@Entity
@Table(name = "payment_events", uniqueConstraints = @UniqueConstraint(columnNames = {"provider", "provider_event_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "event_id")
    private Long eventId;
    @Column(nullable = false, length = 20) private String provider;
    @Column(name = "provider_event_id", nullable = false, length = 120) private String providerEventId;
    @Column(name = "event_type", nullable = false, length = 60) private String eventType;
    @Column(name = "intent_id") private Long intentId;
    @Column(name = "chama_id") private Long chamaId;
    @Column(precision = 15, scale = 2) private BigDecimal amount;
    @Column(length = 3) private String currency;
    /** RECEIVED, CREDITED, UNMATCHED (needs a human) or IGNORED. */
    @Column(nullable = false, length = 20) private String status;
    @Column(length = 300) private String note;
    @Column(columnDefinition = "TEXT") private String payload;
    @Column(name = "received_at", nullable = false) @Builder.Default private ZonedDateTime receivedAt = ZonedDateTime.now();
}
