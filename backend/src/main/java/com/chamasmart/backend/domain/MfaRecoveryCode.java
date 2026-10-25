package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** One single-use recovery code. Only a hash is stored. */
@Entity
@Table(name = "mfa_recovery_codes", indexes = @Index(name = "idx_mfa_recovery_user", columnList = "user_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MfaRecoveryCode {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "code_hash", nullable = false, length = 64)
    private String codeHash;

    @Column(name = "used_at")
    private Instant usedAt;
}
