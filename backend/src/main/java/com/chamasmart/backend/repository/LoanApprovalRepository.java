package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.LoanApproval;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LoanApprovalRepository extends JpaRepository<LoanApproval, Long> {
    List<LoanApproval> findByLoanLoanId(Long loanId);
}
