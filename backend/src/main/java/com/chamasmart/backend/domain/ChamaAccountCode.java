package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;

/** The code that starts every payment account number of a chama, and how the chama collects (its own paybill or the shared one). */
@Entity
@Table(name = "chama_account_codes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChamaAccountCode {
    @Id @Column(name = "chama_id") private Long chamaId;
    @Column(name = "account_code", nullable = false, length = 10, unique = true) private String accountCode;
    /** OWN_PAYBILL (the chama's own shortcode) or POOLED (the shared platform shortcode, switched on only after legal approval). */
    @Column(nullable = false, length = 20) @Builder.Default private String channel = "OWN_PAYBILL";
    @Column(length = 20) private String shortcode;
    @Column(name = "next_seq", nullable = false) @Builder.Default private Integer nextSeq = 1;
}
