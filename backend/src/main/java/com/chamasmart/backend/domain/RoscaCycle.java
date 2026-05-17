package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "rosca_cycles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoscaCycle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "cycle_id")
    private Long cycleId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chama_id", nullable = false)
    private Chama chama;

    @Column(name = "cycle_name", nullable = false, length = 100)
    private String cycleName;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "total_members", nullable = false)
    private Integer totalMembers;

    @Column(name = "contribution_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal contributionAmount;

    @Column(name = "payout_order", length = 20)
    @Builder.Default
    private String payoutOrder = "ROTATIONAL"; // ROTATIONAL, RANDOM, BID

    @Column(length = 20)
    @Builder.Default
    private String status = "ACTIVE"; // ACTIVE, COMPLETED, CANCELLED

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;

    @OneToMany(mappedBy = "cycle", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RoscaRoster> roster = new ArrayList<>();
}
