package com.chamasmart.backend.domain;

import com.chamasmart.backend.util.NationalIdEncryptor;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/** A person's authenticator-app enrolment. The secret is encrypted at rest. */
@Entity
@Table(name = "user_mfa")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserMfa {
    @Id
    @Column(name = "user_id")
    private Long userId;

    @Convert(converter = NationalIdEncryptor.class)
    @Column(nullable = false, length = 512)
    private String secret;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    /** The last 30-second step that was accepted. Codes at or below it are refused, so a code cannot be replayed. */
    @Column(name = "last_used_step", nullable = false)
    private long lastUsedStep;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
