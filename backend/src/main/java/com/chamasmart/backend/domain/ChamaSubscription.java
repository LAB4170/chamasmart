package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.ZonedDateTime;

/** A chama's plan with the platform. States: TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED. Records are never deleted for non-payment. */
@Entity
@Table(name = "chama_subscriptions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChamaSubscription {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "subscription_id") private Long subscriptionId;
    @Column(name = "chama_id", nullable = false) private Long chamaId;
    @Column(name = "plan_code", nullable = false, length = 30) private String planCode;
    @Column(nullable = false, length = 20) private String status;
    @Column(length = 20) private String provider;
    @Column(name = "provider_ref", length = 120) private String providerRef;
    @Column(name = "current_period_end") private ZonedDateTime currentPeriodEnd;
    @Column(name = "created_at", nullable = false) @Builder.Default private ZonedDateTime createdAt = ZonedDateTime.now();
}
