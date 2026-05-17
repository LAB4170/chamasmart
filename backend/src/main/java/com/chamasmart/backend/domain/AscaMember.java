package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Entity
@Table(name = "asca_members", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"cycle_id", "user_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AscaMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "membership_id")
    private Long membershipId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cycle_id", nullable = false)
    private AscaCycle cycle;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "shares_owned", nullable = false)
    @Builder.Default
    private Integer sharesOwned = 0;

    @Column(name = "total_investment", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalInvestment = BigDecimal.ZERO;

    @Column(name = "dividends_earned", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal dividendsEarned = BigDecimal.ZERO;

    @Column(length = 20)
    @Builder.Default
    private String status = "ACTIVE"; // ACTIVE, WITHDRAWN, SUSPENDED

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;
}
