package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.UserMfa;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserMfaRepository extends JpaRepository<UserMfa, Long> {
    /** Checks the flag without loading (and decrypting) the secret. */
    boolean existsByUserIdAndEnabledTrue(Long userId);
}
