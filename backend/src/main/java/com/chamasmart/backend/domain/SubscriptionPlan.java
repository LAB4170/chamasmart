package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "subscription_plans")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SubscriptionPlan {
    @Id @Column(name = "plan_code", length = 30) private String planCode;
    @Column(name = "display_name", nullable = false, length = 60) private String displayName;
    @Column(name = "max_members", nullable = false) private Integer maxMembers;
    @Column(nullable = false, precision = 15, scale = 2) private BigDecimal price;
    @Column(nullable = false, length = 3) private String currency;
    @Column(name = "interval_months", nullable = false) private Integer intervalMonths;
    @Column(nullable = false) private Boolean active;
}
