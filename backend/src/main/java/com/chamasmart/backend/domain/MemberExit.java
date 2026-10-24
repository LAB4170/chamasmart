package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.ZonedDateTime;

/** A member leaving a chama, or being removed from it, with the refund of their savings. */
@Entity
@Table(name = "member_exits")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MemberExit {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "exit_id")
    private Long exitId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chama_id", nullable = false)
    private Chama chama;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** LEAVE (member asked) or REMOVAL (an official started it). */
    @Column(nullable = false, length = 20)
    private String kind;

    /** REQUESTED, APPROVED, COMPLETED, DECLINED, CANCELLED. */
    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "refund_amount", precision = 15, scale = 2)
    private BigDecimal refundAmount;

    @Column(name = "requested_by") private Long requestedBy;
    @Column(name = "approved_by") private Long approvedBy;
    @Column(name = "paid_by") private Long paidBy;
    @Column(name = "payout_reference", length = 100) private String payoutReference;
    @Column(length = 300) private String note;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;
    @Column(name = "completed_at") private ZonedDateTime completedAt;
}
