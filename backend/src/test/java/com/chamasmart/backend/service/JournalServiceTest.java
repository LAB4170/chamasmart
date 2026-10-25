package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.Chama;
import com.chamasmart.backend.domain.JournalEntry;
import com.chamasmart.backend.domain.JournalLine;
import com.chamasmart.backend.domain.LedgerEntry;
import com.chamasmart.backend.ledger.Accounts;
import com.chamasmart.backend.ledger.JournalMapper;
import com.chamasmart.backend.repository.JournalEntryRepository;
import com.chamasmart.backend.repository.JournalLineRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class JournalServiceTest {
    JournalEntryRepository entries = mock(JournalEntryRepository.class);
    JournalLineRepository lines = mock(JournalLineRepository.class);
    JournalService service;
    List<JournalEntry> savedEntries = new ArrayList<>();
    List<JournalLine> savedLines = new ArrayList<>();
    long nextId = 1;

    @BeforeEach
    void setUp() {
        service = new JournalService(entries, lines);
        when(entries.save(any())).thenAnswer(i -> {
            JournalEntry e = i.getArgument(0);
            JournalEntry withId = JournalEntry.builder().entryId(nextId++).chamaId(e.getChamaId()).postedAt(e.getPostedAt()).entryType(e.getEntryType()).referenceType(e.getReferenceType())
                    .referenceId(e.getReferenceId()).actorId(e.getActorId()).memo(e.getMemo()).legacyEntryId(e.getLegacyEntryId()).prevHash(e.getPrevHash()).entryHash(e.getEntryHash()).build();
            savedEntries.add(withId);
            return withId;
        });
        when(lines.save(any())).thenAnswer(i -> { savedLines.add(i.getArgument(0)); return i.getArgument(0); });
        when(entries.findFirstByChamaIdOrderByEntryIdDesc(anyLong())).thenAnswer(i -> savedEntries.isEmpty() ? Optional.empty() : Optional.of(savedEntries.get(savedEntries.size() - 1)));
        when(entries.findByChamaIdOrderByEntryIdAsc(anyLong())).thenAnswer(i -> new ArrayList<>(savedEntries));
        when(lines.findByEntryId(anyLong())).thenAnswer(i -> savedLines.stream().filter(l -> l.getEntryId().equals(i.getArgument(0))).toList());
    }

    private static List<JournalMapper.Line> pair(String dr, String cr, String amount) {
        return List.of(JournalMapper.Line.debit(dr, new BigDecimal(amount)), JournalMapper.Line.credit(cr, new BigDecimal(amount)));
    }

    @Test
    void rejectsUnbalancedEntries() {
        var bad = List.of(JournalMapper.Line.debit(Accounts.CASH, new BigDecimal("100")), JournalMapper.Line.credit(Accounts.MEMBER_SAVINGS, new BigDecimal("99")));
        assertThrows(IllegalArgumentException.class, () -> service.post(1L, "CONTRIBUTION", null, null, null, null, null, bad));
        assertTrue(savedEntries.isEmpty());
    }

    @Test
    void rejectsSingleLineAndNegativeLines() {
        assertThrows(IllegalArgumentException.class, () -> service.post(1L, "X", null, null, null, null, null, List.of(JournalMapper.Line.debit(Accounts.CASH, BigDecimal.TEN))));
        var negative = List.of(new JournalMapper.Line(Accounts.CASH, new BigDecimal("-5"), BigDecimal.ZERO), new JournalMapper.Line(Accounts.MEMBER_SAVINGS, BigDecimal.ZERO, new BigDecimal("-5")));
        assertThrows(IllegalArgumentException.class, () -> service.post(1L, "X", null, null, null, null, null, negative));
    }

    @Test
    void chainsEntriesAndDetectsTampering() {
        service.post(1L, "CONTRIBUTION", "CONTRIBUTION", 10L, 3L, "a", null, pair(Accounts.CASH, Accounts.MEMBER_SAVINGS, "100"));
        service.post(1L, "CONTRIBUTION", "CONTRIBUTION", 11L, 3L, "b", null, pair(Accounts.CASH, Accounts.MEMBER_SAVINGS, "250"));
        service.post(1L, "LOAN_DISBURSEMENT", "LOAN", 5L, 3L, "c", null, pair(Accounts.LOANS_RECEIVABLE, Accounts.CASH, "300"));

        assertEquals(JournalService.GENESIS, savedEntries.get(0).getPrevHash());
        assertEquals(savedEntries.get(0).getEntryHash(), savedEntries.get(1).getPrevHash());
        assertEquals(savedEntries.get(1).getEntryHash(), savedEntries.get(2).getPrevHash());
        assertTrue(service.firstBrokenLink(1L).isEmpty());

        // Someone edits an amount directly in the database.
        JournalLine original = savedLines.get(2);
        savedLines.set(2, JournalLine.builder().lineId(original.getLineId()).entryId(original.getEntryId()).chamaId(1L).account(original.getAccount())
                .debit(new BigDecimal("999.00")).credit(BigDecimal.ZERO).build());
        assertEquals(Optional.of(savedEntries.get(1).getEntryId()), service.firstBrokenLink(1L));
    }

    @Test
    void mirrorIsIdempotentPerLegacyRow() {
        Chama chama = Chama.builder().chamaId(1L).build();
        LedgerEntry legacy = LedgerEntry.builder().entryId(77L).chama(chama).account(LedgerEntry.CHAMA_FUND).amount(new BigDecimal("500.00")).entryType("CONTRIBUTION").build();
        service.mirror(legacy);
        assertEquals(1, savedEntries.size());
        when(entries.existsByLegacyEntryId(77L)).thenReturn(true);
        service.mirror(legacy);
        assertEquals(1, savedEntries.size());
        assertEquals(2, savedLines.size());
    }

    @Test
    void trialBalanceSumsAndFlagsImbalance() {
        when(lines.trialBalance(1L)).thenReturn(List.of(
                new Object[]{"CASH", new BigDecimal("700"), new BigDecimal("0")},
                new Object[]{"MEMBER_SAVINGS", new BigDecimal("0"), new BigDecimal("700")}));
        assertEquals(true, service.trialBalance(1L).get("balanced"));
        when(lines.trialBalance(2L)).thenReturn(List.<Object[]>of(new Object[]{"CASH", new BigDecimal("700"), new BigDecimal("0")}));
        assertEquals(false, service.trialBalance(2L).get("balanced"));
    }
}
