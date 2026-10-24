package com.chamasmart.backend.repository;
import com.chamasmart.backend.domain.LedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.math.BigDecimal;
import java.util.List;

@Repository
public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, Long> {
    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM LedgerEntry e WHERE e.chama.chamaId = :chamaId AND e.account = :account")
    BigDecimal balance(@Param("chamaId") Long chamaId, @Param("account") String account);

    List<LedgerEntry> findTop100ByChamaChamaIdOrderByEntryIdDesc(Long chamaId);
}
