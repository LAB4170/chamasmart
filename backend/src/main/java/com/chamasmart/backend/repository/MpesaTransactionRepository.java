package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.MpesaTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MpesaTransactionRepository extends JpaRepository<MpesaTransaction, Long> {
    Optional<MpesaTransaction> findByCheckoutRequestId(String checkoutRequestId);
}
