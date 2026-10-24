package com.chamasmart.backend.domain;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDate;
import java.time.ZonedDateTime;
@Entity
@Table(name = "rosca_roster", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"cycle_id", "user_id"}),
    @UniqueConstraint(columnNames = {"cycle_id", "position"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoscaRoster {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "roster_id")
    private Long rosterId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cycle_id", nullable = false)
    private RoscaCycle cycle;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @Column(nullable = false)
    private Integer position;
    @Column(length = 20)
    @Builder.Default
    private String status = "ACTIVE"; // ACTIVE, PAYOUT_PENDING, PAID, SKIPPED, RECEIVED, DEFAULTED
    /** The official who asked for this payout. Pots at or above the approval threshold need a different official to release them. */
    @Column(name = "payout_requested_by")
    private Long payoutRequestedBy;
    @Column(name = "payout_date")
    private LocalDate payoutDate;
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;
}

