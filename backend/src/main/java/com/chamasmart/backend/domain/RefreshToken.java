package com.chamasmart.backend.domain;
import jakarta.persistence.*;
import java.time.Instant;
@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true)
    private String token;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
    @Column(name = "revoked", nullable = false)
    private boolean revoked = false;
    @Column(name = "created_at")
    private Instant createdAt = Instant.now();
    @Column(name = "user_agent", length = 200)
    private String userAgent;
    public Instant getCreatedAt() { return createdAt; }
    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String ua) { this.userAgent = ua == null ? null : ua.substring(0, Math.min(200, ua.length())); }
    // getters & setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public boolean isRevoked() { return revoked; }
    public void setRevoked(boolean revoked) { this.revoked = revoked; }
}

