package com.chamasmart.backend.repository;
import com.chamasmart.backend.domain.LoanRepayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
/* Status is filtered in Java: every String column is Base64-stored (finding S-18), so a status literal in JPQL never matches. */
public interface LoanRepaymentRepository extends JpaRepository<LoanRepayment, Long> {
    @Query("SELECT r FROM LoanRepayment r JOIN FETCH r.loan l JOIN FETCH r.payer WHERE l.loanId = :loanId ORDER BY r.createdAt ASC")
    List<LoanRepayment> findByLoanId(@Param("loanId") Long loanId);

    @Query("SELECT r FROM LoanRepayment r JOIN FETCH r.loan l JOIN FETCH r.payer WHERE l.chama.chamaId = :chamaId ORDER BY r.createdAt ASC")
    List<LoanRepayment> findByChamaId(@Param("chamaId") Long chamaId);
}
