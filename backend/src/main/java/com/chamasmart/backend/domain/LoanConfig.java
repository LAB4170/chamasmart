package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.ZonedDateTime;

/** Loan rules set by a chama's officials. One row per chama; defaults apply until an official saves one. */
@Entity
@Table(name = "loan_configs", uniqueConstraints = @UniqueConstraint(columnNames = "chama_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoanConfig {
    public static final BigDecimal DEFAULT_RATE = BigDecimal.valueOf(10);
    public static final BigDecimal DEFAULT_MULTIPLIER = BigDecimal.valueOf(3);
    public static final int DEFAULT_MAX_MONTHS = 12;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "config_id")
    private Long configId;

    @Column(name = "chama_id", nullable = false)
    private Long chamaId;

    /** Annual percentage rate. */
    @Column(name = "interest_rate", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal interestRate = DEFAULT_RATE;

    /** FLAT or REDUCING_BALANCE. */
    @Column(name = "interest_type", nullable = false, length = 20)
    @Builder.Default
    private String interestType = com.chamasmart.backend.service.LoanCalculator.FLAT;

    /** Maximum loan = member's total contributions x multiplier. */
    @Column(name = "loan_multiplier", nullable = false, precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal loanMultiplier = DEFAULT_MULTIPLIER;

    @Column(name = "max_repayment_months", nullable = false)
    @Builder.Default
    private Integer maxRepaymentMonths = DEFAULT_MAX_MONTHS;

    /** When true, guarantor pledges must cover the full repayable amount. */
    @Column(name = "require_guarantors", nullable = false)
    @Builder.Default
    private Boolean requireGuarantors = true;

    /** Late fee as a percent of an unpaid instalment, charged once when it goes overdue. 0 switches it off. */
    @Column(name = "late_fee_percent", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal lateFeePercent = BigDecimal.ZERO;

    /** Loans at or above this amount need {@code committeeSize} distinct officials to approve. */
    @Column(name = "committee_threshold", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal committeeThreshold = BigDecimal.valueOf(20000);

    @Column(name = "committee_size")
    @Builder.Default
    private Integer committeeSize = 2;

    /** Loan protection premium as a percent of each new loan, kept in the chama's cover reserve. Null or zero means no cover. */
    @Column(name = "cover_percent", precision = 5, scale = 2)
    private BigDecimal coverPercent;

    @Column(name = "updated_at")
    private ZonedDateTime updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy;

    public static LoanConfig defaults(Long chamaId) {
        return LoanConfig.builder().chamaId(chamaId).build();
    }
}
