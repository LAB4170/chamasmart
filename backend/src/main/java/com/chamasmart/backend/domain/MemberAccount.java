package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;

/** A member's payment account number in one chama. Never reused, never changes. */
@Entity
@Table(name = "member_accounts", uniqueConstraints = @UniqueConstraint(columnNames = {"chama_id", "user_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MemberAccount {
    @Id @Column(name = "account_number", length = 20) private String accountNumber;
    @Column(name = "chama_id", nullable = false) private Long chamaId;
    @Column(name = "user_id", nullable = false) private Long userId;
    @Column(nullable = false) private Integer seq;
}
