package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/** One debit or credit of a journal entry. */
@Entity
@Table(name = "journal_lines")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JournalLine {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "line_id")
    private Long lineId;

    @Column(name = "entry_id", nullable = false, updatable = false)
    private Long entryId;

    @Column(name = "chama_id", nullable = false, updatable = false)
    private Long chamaId;

    @Column(nullable = false, length = 30, updatable = false)
    private String account;

    @Column(nullable = false, precision = 15, scale = 2, updatable = false)
    private BigDecimal debit;

    @Column(nullable = false, precision = 15, scale = 2, updatable = false)
    private BigDecimal credit;
}
