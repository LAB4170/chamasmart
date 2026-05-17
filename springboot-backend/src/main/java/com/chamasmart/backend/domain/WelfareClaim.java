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
@Table(name = "welfare_claims")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WelfareClaim {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "claim_id")
    private Long claimId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chama_id", nullable = false)
    private Chama chama;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private User member;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_type_id", nullable = false)
    private WelfareConfig eventType;

    @Column(name = "claim_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal claimAmount;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "SUBMITTED"; // SUBMITTED, VERIFIED, APPROVED, PAID, REJECTED

    @Column(name = "date_of_occurrence", nullable = false)
    private LocalDate dateOfOccurrence;

    @Column(name = "proof_document_url", length = 500)
    private String proofDocumentUrl;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;

    @Column(name = "verified_at")
    private ZonedDateTime verifiedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "verified_by")
    private User verifiedBy;

    @Column(name = "approved_at")
    private ZonedDateTime approvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private User approvedBy;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @OneToMany(mappedBy = "claim", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<WelfareClaimApproval> approvals = new ArrayList<>();
}
