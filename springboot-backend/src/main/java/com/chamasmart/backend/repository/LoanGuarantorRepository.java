package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.LoanGuarantor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LoanGuarantorRepository extends JpaRepository<LoanGuarantor, Long> {

    @Query("SELECT lg FROM LoanGuarantor lg JOIN FETCH lg.loan l JOIN FETCH l.chama JOIN FETCH l.borrower WHERE lg.guarantorUser.userId = :guarantorUserId ORDER BY lg.createdAt DESC")
    List<LoanGuarantor> findByGuarantorUserUserId(@Param("guarantorUserId") Long guarantorUserId);

    List<LoanGuarantor> findByLoanLoanId(Long loanId);

    Optional<LoanGuarantor> findByLoanLoanIdAndGuarantorUserUserId(Long loanId, Long guarantorUserId);
}
