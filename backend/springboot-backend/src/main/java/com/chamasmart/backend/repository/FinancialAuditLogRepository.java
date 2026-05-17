package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.FinancialAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FinancialAuditLogRepository extends JpaRepository<FinancialAuditLog, Long> {
    List<FinancialAuditLog> findByChamaChamaIdOrderByCreatedAtDesc(Long chamaId);
}
