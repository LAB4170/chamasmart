package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.LoanCoverClaim;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LoanCoverClaimRepository extends JpaRepository<LoanCoverClaim, Long> {
    List<LoanCoverClaim> findByChamaIdOrderByCreatedAtDesc(Long chamaId);
    boolean existsByLoanLoanIdAndStatus(Long loanId, String status);
}
