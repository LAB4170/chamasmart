package com.chamasmart.backend.domain;

import jakarta.persistence.*;
import jakarta.persistence.Convert;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.ZonedDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    private static final Logger log = LoggerFactory.getLogger(User.class);

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "phone_number", unique = true, length = 20)
    private String phoneNumber;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(length = 50)
    @Builder.Default
    private String role = "MEMBER";

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "email_verified")
    @Builder.Default
    private Boolean emailVerified = false;

    @Column(name = "phone_verified")
    @Builder.Default
    private Boolean phoneVerified = false;

    @Column(name = "auth_method", length = 20)
    @Builder.Default
    private String authMethod = "email";

    @Column(name = "trust_score")
    @Builder.Default
    private Integer trustScore = 50;

    @Column(name = "national_id", length = 50)
    @Convert(converter = com.chamasmart.backend.util.NationalIdEncryptor.class)
    private String nationalId;

    @Column(name = "profile_picture_url", length = 1000)
    private String profilePictureUrl;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private ZonedDateTime createdAt;

    // No-args constructor (required by JPA)
    public User() {}

    // All-args constructor for manual creation (used in AuthController)
    public User(String firstName, String lastName, String email, String phoneNumber, String passwordHash,
                String role, Boolean isActive, Boolean emailVerified, Boolean phoneVerified, String authMethod) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.phoneNumber = phoneNumber;
        this.passwordHash = passwordHash;
        this.role = role;
        this.isActive = isActive;
        this.emailVerified = emailVerified;
        this.phoneVerified = phoneVerified;
        this.authMethod = authMethod;
    }

    @UpdateTimestamp
    @Column(name = "updated_at")
    private ZonedDateTime updatedAt;

    // Explicit getters for fields used where Lombok failed
    public Long getUserId() { return userId; }
    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getRole() { return role; }
    public Boolean getIsActive() { return isActive; }
    public Boolean getEmailVerified() { return emailVerified; }
    public Boolean getPhoneVerified() { return phoneVerified; }
    public String getAuthMethod() { return authMethod; }
    public Integer getTrustScore() { return trustScore; }
    public String getNationalId() { return nationalId; }
    public String getProfilePictureUrl() { return profilePictureUrl; }
    public ZonedDateTime getCreatedAt() { return createdAt; }
    public ZonedDateTime getUpdatedAt() { return updatedAt; }
}


