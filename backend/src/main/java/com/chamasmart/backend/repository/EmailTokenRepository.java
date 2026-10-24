package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.EmailToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface EmailTokenRepository extends JpaRepository<EmailToken, Long> {
    Optional<EmailToken> findByTokenHash(String hash);
    List<EmailToken> findByUserIdAndPurposeAndUsedAtIsNull(Long userId, String purpose);
    long countByUserIdAndPurposeAndCreatedAtAfter(Long userId, String purpose, java.time.ZonedDateTime after);
    void deleteByExpiresAtBefore(Instant cutoff);
}
