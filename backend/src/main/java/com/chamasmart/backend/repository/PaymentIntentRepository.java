package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.PaymentIntent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentIntentRepository extends JpaRepository<PaymentIntent, Long> {
    Optional<PaymentIntent> findByUserIdAndIdempotencyKey(Long userId, String key);
    List<PaymentIntent> findByChamaIdAndUserIdOrderByCreatedAtDesc(Long chamaId, Long userId);
}
