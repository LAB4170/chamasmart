package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Entity
@Table(name = "chama_members", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"chama_id", "user_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChamaMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "membership_id")
    private Long membershipId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chama_id", nullable = false)
    private Chama chama;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(length = 50)
    @Builder.Default
    private String role = "MEMBER";

    @Column(length = 20)
    @Builder.Default
    private String status = "ACTIVE";

    @CreationTimestamp
    @Column(name = "join_date", updatable = false)
    private ZonedDateTime joinDate;

    @Column(name = "total_contributions", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalContributions = BigDecimal.ZERO;

    @Column(name = "last_contribution_date")
    private ZonedDateTime lastContributionDate;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;
}
