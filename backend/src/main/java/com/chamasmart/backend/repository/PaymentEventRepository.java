package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.PaymentEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentEventRepository extends JpaRepository<PaymentEvent, Long> {
    Optional<PaymentEvent> findByProviderAndProviderEventId(String provider, String providerEventId);
    List<PaymentEvent> findTop100ByStatusOrderByReceivedAtDesc(String status);
    List<PaymentEvent> findByChamaIdAndStatusOrderByReceivedAtDesc(Long chamaId, String status);
    List<PaymentEvent> findByChamaIdIsNullAndStatusOrderByReceivedAtDesc(String status);
}
