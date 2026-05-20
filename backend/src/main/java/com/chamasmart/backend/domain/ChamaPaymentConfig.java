package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.ZonedDateTime;

@Entity
@Table(name = "chama_payment_configs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChamaPaymentConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "config_id")
    private Long configId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chama_id", referencedColumnName = "chama_id", nullable = false)
    private Chama chama;

    @Column(name = "payment_type", nullable = false, length = 50)
    private String paymentType;

    @Column(name = "business_number", length = 50)
    private String businessNumber;

    @Column(name = "account_number", length = 100)
    private String accountNumber;

    @Column(name = "phone_number", length = 20)
    private String phoneNumber;

    @Column(name = "recipient_name", length = 255)
    private String recipientName;

    @Column(name = "bank_name", length = 100)
    private String bankName;

    @Column(name = "bank_account_number", length = 100)
    private String bankAccountNumber;

    @Column(name = "bank_account_name", length = 255)
    private String bankAccountName;

    @Column(name = "bank_branch", length = 100)
    private String bankBranch;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private ZonedDateTime updatedAt;
}
