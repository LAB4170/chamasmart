package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.ChamaPaymentConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ChamaPaymentConfigRepository extends JpaRepository<ChamaPaymentConfig, Long> {
    Optional<ChamaPaymentConfig> findByChamaChamaId(Long chamaId);
}
