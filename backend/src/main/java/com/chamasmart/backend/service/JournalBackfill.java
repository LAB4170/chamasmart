package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.LedgerEntry;
import com.chamasmart.backend.repository.LedgerEntryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

/** On start, gives every older single-entry ledger row its double-entry twin. Rows already mirrored are skipped. */
@Component
@RequiredArgsConstructor
@Slf4j
@Order(50)
public class JournalBackfill implements ApplicationRunner {
    private final LedgerEntryRepository ledgerRepository;
    private final JournalService journal;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        try {
            List<LedgerEntry> all = ledgerRepository.findAll().stream().sorted(Comparator.comparing(LedgerEntry::getEntryId)).toList();
            int made = journal.backfill(all);
            if (made > 0) log.info("Journal back-fill: created {} double-entry postings from the older ledger", made);
        } catch (RuntimeException e) {
            log.error("Journal back-fill did not finish; the app keeps running and will retry on the next start", e);
        }
    }
}
