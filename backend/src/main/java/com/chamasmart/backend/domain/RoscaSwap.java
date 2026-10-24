package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.ZonedDateTime;

/** A request to trade payout turns between two members of a merry-go-round cycle. */
@Entity
@Table(name = "rosca_swaps")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoscaSwap {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "swap_id")
    private Long swapId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cycle_id", nullable = false)
    private RoscaCycle cycle;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requester_id", nullable = false)
    private User requester;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "target_id", nullable = false)
    private User target;

    /** PENDING, ACCEPTED, DECLINED, CANCELLED. */
    @Column(nullable = false, length = 20)
    private String status;

    @Column(length = 300)
    private String reason;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;

    @Column(name = "responded_at")
    private ZonedDateTime respondedAt;
}
