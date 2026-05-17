package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.Loan;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LoanRepository extends JpaRepository<Loan, Long> {
    
    @Query("SELECT l FROM Loan l JOIN FETCH l.chama JOIN FETCH l.borrower WHERE l.borrower.userId = :borrowerId ORDER BY l.createdAt DESC")
    List<Loan> findByBorrowerUserId(@Param("borrowerId") Long borrowerId);

    @Query("SELECT l FROM Loan l JOIN FETCH l.chama JOIN FETCH l.borrower WHERE l.chama.chamaId = :chamaId ORDER BY l.createdAt DESC")
    List<Loan> findByChamaChamaId(@Param("chamaId") Long chamaId);

    List<Loan> findByStatus(String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT l FROM Loan l WHERE l.loanId = :loanId")
    Optional<Loan> findByIdWithPessimisticLock(@Param("loanId") Long loanId);
}
