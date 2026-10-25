package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.ChamaAccountCode;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ChamaAccountCodeRepository extends JpaRepository<ChamaAccountCode, Long> {
    boolean existsByAccountCode(String accountCode);
    Optional<ChamaAccountCode> findFirstByShortcode(String shortcode);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM ChamaAccountCode c WHERE c.chamaId = :id")
    Optional<ChamaAccountCode> lockById(@Param("id") Long chamaId);
}
