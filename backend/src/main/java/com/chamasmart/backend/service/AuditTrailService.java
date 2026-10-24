package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.FinancialAuditLog;
import com.chamasmart.backend.repository.FinancialAuditLogRepository;
import com.chamasmart.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * One audit trail for sign-ins, account changes and every money action. Entries are sealed into a hash chain a few minutes
 * after they are written, so an edit or deletion of an old entry is detectable.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditTrailService {
    private static final String GENESIS = "0".repeat(64);
    private final FinancialAuditLogRepository repo;
    private final UserRepository users;

    /** Records who did what to what, from where. */
    @Transactional
    public void record(Long actorId, String action, String subjectType, Long subjectId, String ip, String detail) {
        repo.save(FinancialAuditLog.builder()
                .user(actorId == null ? null : users.getReferenceById(actorId))
                .transactionType(action)
                .referenceId(subjectId)
                .description(detail == null ? subjectType : subjectType + ": " + detail)
                .ipAddress(ip)
                .build());
    }

    static String canonical(FinancialAuditLog l) {
        BigDecimal amt = l.getAmount() == null ? null : l.getAmount().setScale(2, java.math.RoundingMode.HALF_UP);
        return String.join("|",
                String.valueOf(l.getAuditId()),
                l.getUser() == null ? "-" : String.valueOf(l.getUser().getUserId()),
                String.valueOf(l.getTransactionType()),
                amt == null ? "-" : amt.toPlainString(),
                l.getChama() == null ? "-" : String.valueOf(l.getChama().getChamaId()),
                String.valueOf(l.getReferenceId()),
                String.valueOf(l.getDescription()),
                l.getCreatedAt() == null ? "-" : String.valueOf(l.getCreatedAt().toEpochSecond()));
    }

    static String hash(String prev, FinancialAuditLog l) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((prev + "#" + canonical(l)).getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    /** Adds every unsealed entry to the chain, oldest first. Returns how many were sealed. */
    @Scheduled(fixedDelay = 300_000, initialDelay = 60_000)
    @Transactional
    public synchronized int seal() {
        List<FinancialAuditLog> pending = repo.findByRowHashIsNullOrderByAuditIdAsc();
        if (pending.isEmpty()) return 0;
        String prev = repo.findTopByRowHashIsNotNullOrderByAuditIdDesc().map(FinancialAuditLog::getRowHash).orElse(GENESIS);
        for (FinancialAuditLog l : pending) {
            l.setPrevHash(prev);
            prev = hash(prev, l);
            l.setRowHash(prev);
        }
        repo.saveAll(pending);
        return pending.size();
    }

    /** Re-computes the chain. Returns the id of the first entry that does not match, or null when it is intact. */
    @Transactional
    public Map<String, Object> verify() {
        seal();
        String prev = GENESIS;
        long checked = 0;
        Long broken = null;
        for (FinancialAuditLog l : repo.findAllByOrderByAuditIdAsc()) {
            if (l.getRowHash() == null) continue;
            if (!prev.equals(l.getPrevHash()) || !hash(prev, l).equals(l.getRowHash())) { broken = l.getAuditId(); break; }
            prev = l.getRowHash();
            checked++;
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("intact", broken == null);
        m.put("entries_checked", checked);
        m.put("first_broken_entry", broken);
        if (broken != null) log.error("Audit trail integrity check failed at entry {}", broken);
        return m;
    }
}
