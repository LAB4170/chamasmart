package com.chamasmart.backend.domain;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.math.BigDecimal;
import java.time.ZonedDateTime;
@Entity
@Table(name = "financial_audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FinancialAuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "audit_id")
    private Long auditId;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;
    @Column(name = "transaction_type", nullable = false, length = 50)
    private String transactionType;
    @Column(precision = 15, scale = 2)
    private BigDecimal amount;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chama_id")
    private Chama chama;
    @Column(name = "reference_id")
    private Long referenceId;
    @Column(columnDefinition = "TEXT")
    private String description;
    @Column(name = "ip_address", length = 45)
    private String ipAddress;
    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent;
    /** Hash of the previous sealed entry and of this one. Changing or removing an old entry breaks every hash after it. */
    @Column(name = "prev_hash", length = 64)
    private String prevHash;
    @Column(name = "row_hash", length = 64)
    private String rowHash;

    /** Stamps the caller's address and browser on every entry written during a web request. */
    @PrePersist
    void stampRequest() {
        if (ipAddress != null) return;
        var attrs = org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
        if (attrs instanceof org.springframework.web.context.request.ServletRequestAttributes sra) {
            ipAddress = com.chamasmart.backend.security.ClientIp.of(sra.getRequest());
            String ua = sra.getRequest().getHeader("User-Agent");
            if (userAgent == null && ua != null) userAgent = ua.substring(0, Math.min(300, ua.length()));
        }
    }

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;
}

