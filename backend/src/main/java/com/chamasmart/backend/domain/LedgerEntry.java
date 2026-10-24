package com.chamasmart.backend.domain;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.math.BigDecimal;
import java.time.ZonedDateTime;

/**
 * One line of the journal. Fund balances are the sum of these lines; the stored totals on a chama and on the welfare
 * fund are a convenience that is reconciled against them every night. Entries are only ever added, never edited.
 */
@Entity
@Table(name = "ledger_entries", indexes = @Index(name = "idx_ledger_chama_account", columnList = "chama_id, account"))
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LedgerEntry {
    public static final String CHAMA_FUND = "CHAMA_FUND";
    public static final String WELFARE_FUND = "WELFARE_FUND";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "entry_id")
    private Long entryId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chama_id", nullable = false, updatable = false)
    private Chama chama;

    @Column(nullable = false, length = 20, updatable = false)
    private String account;

    /** Positive adds to the fund, negative takes from it. */
    @Column(nullable = false, precision = 15, scale = 2, updatable = false)
    private BigDecimal amount;

    @Column(name = "entry_type", nullable = false, length = 40, updatable = false)
    private String entryType;

    @Column(name = "reference_type", length = 40, updatable = false)
    private String referenceType;

    @Column(name = "reference_id", updatable = false)
    private Long referenceId;

    @Column(name = "actor_id", updatable = false)
    private Long actorId;

    @Column(length = 300, updatable = false)
    private String memo;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;
}
