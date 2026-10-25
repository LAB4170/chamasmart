package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.MfaRecoveryCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MfaRecoveryCodeRepository extends JpaRepository<MfaRecoveryCode, Long> {
    Optional<MfaRecoveryCode> findByUserIdAndCodeHashAndUsedAtIsNull(Long userId, String codeHash);
    List<MfaRecoveryCode> findByUserId(Long userId);
    long countByUserIdAndUsedAtIsNull(Long userId);
    void deleteByUserId(Long userId);
}
