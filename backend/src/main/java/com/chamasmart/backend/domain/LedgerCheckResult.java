package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.ZonedDateTime;

@Entity
@Table(name = "ledger_check_results")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LedgerCheckResult {
    @Id @Column(name = "chama_id") private Long chamaId;
    @Column(name = "all_ok", nullable = false) private Boolean allOk;
    @Column(nullable = false) private Integer failed;
    @Column(name = "checked_at", nullable = false) private ZonedDateTime checkedAt;
}
