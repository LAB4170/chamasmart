package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.LoanConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LoanConfigRepository extends JpaRepository<LoanConfig, Long> {
    Optional<LoanConfig> findByChamaId(Long chamaId);
}
