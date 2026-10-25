package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.JournalLine;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface JournalLineRepository extends JpaRepository<JournalLine, Long> {
    List<JournalLine> findByEntryId(Long entryId);

    /** [account, total debit, total credit] for every account of one chama. */
    @Query("SELECT l.account, COALESCE(SUM(l.debit), 0), COALESCE(SUM(l.credit), 0) FROM JournalLine l WHERE l.chamaId = :chamaId GROUP BY l.account ORDER BY l.account")
    List<Object[]> trialBalance(@Param("chamaId") Long chamaId);

    @Query("SELECT COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) FROM JournalLine l WHERE l.chamaId = :chamaId AND l.account = :account")
    BigDecimal debitBalance(@Param("chamaId") Long chamaId, @Param("account") String account);
}
