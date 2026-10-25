package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.LedgerCheckResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LedgerCheckResultRepository extends JpaRepository<LedgerCheckResult, Long> {
}
