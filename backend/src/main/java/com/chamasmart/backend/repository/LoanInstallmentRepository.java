package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.LoanInstallment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LoanInstallmentRepository extends JpaRepository<LoanInstallment, Long> {
    List<LoanInstallment> findByLoanLoanIdOrderByNumberAsc(Long loanId);
}
