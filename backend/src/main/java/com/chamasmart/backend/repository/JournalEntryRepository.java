package com.chamasmart.backend.repository;

import com.chamasmart.backend.domain.JournalEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JournalEntryRepository extends JpaRepository<JournalEntry, Long> {
    Optional<JournalEntry> findFirstByChamaIdOrderByEntryIdDesc(Long chamaId);
    List<JournalEntry> findByChamaIdOrderByEntryIdAsc(Long chamaId);
    boolean existsByLegacyEntryId(Long legacyEntryId);
    boolean existsByReversesEntryId(Long reversesEntryId);

    @Query("SELECT DISTINCT e.chamaId FROM JournalEntry e")
    List<Long> chamaIdsWithEntries();
}
