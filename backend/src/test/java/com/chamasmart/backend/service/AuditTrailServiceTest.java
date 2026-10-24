package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.FinancialAuditLog;
import com.chamasmart.backend.repository.FinancialAuditLogRepository;
import com.chamasmart.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuditTrailServiceTest {
    private FinancialAuditLogRepository repo;
    private AuditTrailService svc;
    private final List<FinancialAuditLog> rows = new ArrayList<>();

    private FinancialAuditLog row(long id, String type, String amount) {
        return FinancialAuditLog.builder().auditId(id).transactionType(type).amount(amount == null ? null : new BigDecimal(amount))
                .description("d" + id).createdAt(ZonedDateTime.now().minusMinutes(10 - id)).build();
    }

    @BeforeEach
    void setUp() {
        repo = mock(FinancialAuditLogRepository.class);
        svc = new AuditTrailService(repo, mock(UserRepository.class));
        rows.clear();
        rows.add(row(1, "LOGIN", null));
        rows.add(row(2, "LOAN_DISBURSED", "5000.00"));
        rows.add(row(3, "PAYOUT", "1200.50"));
        when(repo.findByRowHashIsNullOrderByAuditIdAsc()).thenAnswer(i -> rows.stream().filter(r -> r.getRowHash() == null).toList());
        when(repo.findTopByRowHashIsNotNullOrderByAuditIdDesc()).thenAnswer(i -> rows.stream().filter(r -> r.getRowHash() != null).reduce((a, b) -> b));
        when(repo.findAllByOrderByAuditIdAsc()).thenAnswer(i -> new ArrayList<>(rows));
    }

    @Test
    void sealsEveryEntryAndVerifiesIntact() {
        assertEquals(3, svc.seal());
        assertEquals(0, svc.seal());
        assertEquals(true, svc.verify().get("intact"));
        rows.add(row(4, "PAYOUT", "10.00"));
        assertEquals(1, svc.seal());
        assertEquals(true, svc.verify().get("intact"));
    }

    @Test
    void changingAnOldAmountIsDetected() {
        svc.seal();
        rows.get(1).setAmount(new BigDecimal("50.00"));
        var r = svc.verify();
        assertEquals(false, r.get("intact"));
        assertEquals(2L, r.get("first_broken_entry"));
    }

    @Test
    void deletingAnEntryIsDetected() {
        svc.seal();
        rows.remove(1);
        var r = svc.verify();
        assertEquals(false, r.get("intact"));
        assertEquals(3L, r.get("first_broken_entry"));
    }
}
