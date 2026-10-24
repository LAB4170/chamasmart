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

    @Column(name = "updated_at")
    private ZonedDateTime updatedAt;

    @Column(name = "updated_by")
    private Long updatedBy;

    public static LoanConfig defaults(Long chamaId) {
        return LoanConfig.builder().chamaId(chamaId).build();
    }
}
