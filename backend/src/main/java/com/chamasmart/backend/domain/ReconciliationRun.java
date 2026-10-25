package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Entity
@Table(name = "reconciliation_runs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ReconciliationRun {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) @Column(name = "run_id") private Long runId;
    @Column(name = "chama_id", nullable = false) private Long chamaId;
    @Column(name = "run_by") private Long runBy;
    @Column(name = "run_at", nullable = false) @Builder.Default private ZonedDateTime runAt = ZonedDateTime.now();
    @Column(name = "statement_lines", nullable = false) private Integer statementLines;
    @Column(name = "statement_total", nullable = false, precision = 15, scale = 2) private BigDecimal statementTotal;
    @Column(nullable = false) private Integer matched;
    @Column(nullable = false) private Integer missing;
    @Column(nullable = false) private Integer held;
    @Column(name = "amount_differs", nullable = false) private Integer amountDiffers;
    @Column(nullable = false) private Integer pending;
    @Column(nullable = false) private Boolean reconciled;
}
