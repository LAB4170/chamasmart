package com.chamasmart.backend.repository;
import com.chamasmart.backend.domain.MpesaTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Repository;
import java.util.List;
@Repository
public interface MpesaTransactionRepository extends JpaRepository<MpesaTransaction, Long> {
    List<MpesaTransaction> findByUserUserId(Long userId);
    java.util.Optional<MpesaTransaction> findByCheckoutRequestId(String checkoutRequestId);
    /** Row-locked lookup so concurrent callbacks for one payment are processed one at a time. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM MpesaTransaction t WHERE t.checkoutRequestId = :id")
    java.util.Optional<MpesaTransaction> findByCheckoutRequestIdForUpdate(@Param("id") String id);
}

