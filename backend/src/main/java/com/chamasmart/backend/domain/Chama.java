package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.time.ZonedDateTime;

@Entity
@Table(name = "chamas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Chama {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "chama_id")
    private Long chamaId;

    @Column(name = "chama_name", nullable = false)
    private String chamaName;

    @Column(name = "chama_type", nullable = false, length = 50)
    private String chamaType;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "contribution_amount", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal contributionAmount = BigDecimal.ZERO;

    @Column(name = "contribution_frequency", length = 20)
    @Builder.Default
    private String contributionFrequency = "MONTHLY";

    @Column(name = "contribution_day")
    @Builder.Default
    private Integer contributionDay = 1;

    @Column(name = "meeting_day")
    private String meetingDay;

    @Column(name = "meeting_time")
    private LocalTime meetingTime;

    @Column(name = "current_fund", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal currentFund = BigDecimal.ZERO;

    @Column(name = "total_members")
    @Builder.Default
    private Integer totalMembers = 0;

    @Column(length = 20)
    @Builder.Default
    private String visibility = "PRIVATE";

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private ZonedDateTime updatedAt;

    @Column(name = "custody_type", length = 20)
    @Builder.Default
    private String custodyType = "MANAGED";

    @Column(name = "virtual_account_ref", unique = true, length = 50)
    private String virtualAccountRef;

    @Version
    @Column(name = "version")
    private Long version;
}
