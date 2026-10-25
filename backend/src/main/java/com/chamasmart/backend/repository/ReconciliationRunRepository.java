package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.ReconciliationRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ReconciliationRunRepository extends JpaRepository<ReconciliationRun, Long> {
    Optional<ReconciliationRun> findFirstByChamaIdOrderByRunAtDesc(Long chamaId);
}
