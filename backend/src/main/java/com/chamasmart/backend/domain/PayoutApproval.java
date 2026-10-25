package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.ZonedDateTime;

@Entity
@Table(name = "payout_approvals", uniqueConstraints = @UniqueConstraint(columnNames = {"payout_id", "approver_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PayoutApproval {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "approval_id") private Long approvalId;
    @Column(name = "payout_id", nullable = false) private Long payoutId;
    @Column(name = "approver_id", nullable = false) private Long approverId;
    @Column(name = "approved_at", nullable = false) @Builder.Default private ZonedDateTime approvedAt = ZonedDateTime.now();
}
