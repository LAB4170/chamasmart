package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.ZonedDateTime;

/**
 * A fine a member owes their chama. It is created by an official, or by the system when a merry-go-round round is paid late.
 * It is settled when FINE payments are verified for that member, or waived by an official with a reason.
 * (source, cycle, round, user) is unique, so the daily job can never fine the same person twice for the same round.
 */
@Entity
@Table(name = "member_fines", uniqueConstraints = @UniqueConstraint(columnNames = {"source", "cycle_id", "round_no", "user_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MemberFine {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "fine_id")
    private Long fineId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chama_id", nullable = false)
    private Chama chama;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "amount_paid", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal amountPaid = BigDecimal.ZERO;

    @Column(nullable = false, length = 300)
    private String reason;

    /** MANUAL or ROSCA_LATE. */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String source = "MANUAL";

    @Column(name = "cycle_id")
    private Long cycleId;

    @Column(name = "round_no")
    private Integer roundNo;

    /** OWED, PAID or WAIVED. */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "OWED";

    /** Null when the system issued it. */
    @Column(name = "issued_by")
    private Long issuedBy;

    @Column(name = "closed_by")
    private Long closedBy;

    @Column(name = "closed_note", length = 300)
    private String closedNote;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;

    @Column(name = "closed_at")
    private ZonedDateTime closedAt;

    public BigDecimal outstanding() {
        BigDecimal paid = amountPaid == null ? BigDecimal.ZERO : amountPaid;
        return amount.subtract(paid).max(BigDecimal.ZERO);
    }
}
