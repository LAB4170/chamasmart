package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.Payout;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PayoutRepository extends JpaRepository<Payout, Long> {
    Optional<Payout> findByRequestedByAndIdempotencyKey(Long requestedBy, String key);
    List<Payout> findTop100ByChamaIdOrderByCreatedAtDesc(Long chamaId);
    boolean existsByChamaIdAndStatus(Long chamaId, String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Payout p WHERE p.payoutId = :id")
    Optional<Payout> lockById(@Param("id") Long id);

    /** What has been asked for, approved or paid since a moment: the daily limit counts all three. */
    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payout p WHERE p.chamaId = :chamaId AND p.createdAt >= :since AND p.status IN ('REQUESTED','APPROVED','PAID')")
    BigDecimal committedSince(@Param("chamaId") Long chamaId, @Param("since") ZonedDateTime since);
}
