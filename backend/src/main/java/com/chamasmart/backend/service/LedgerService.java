package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/** The journal behind the fund balances, and the check that the two agree. */
@Service
@RequiredArgsConstructor
@Slf4j
public class LedgerService {
    private final LedgerEntryRepository ledgerRepository;
    private final ChamaRepository chamaRepository;
    private final WelfareFundRepository welfareFundRepository;
    private final ChamaMemberRepository chamaMemberRepository;

    /** Called in the same transaction as the balance change it records. */
    public void post(Chama chama, String account, BigDecimal signedAmount, String entryType, String referenceType, Long referenceId, Long actorId, String memo) {
        if (signedAmount == null || signedAmount.signum() == 0) return;
        ledgerRepository.save(LedgerEntry.builder()
                .chama(chama).account(account).amount(signedAmount.setScale(2, RoundingMode.HALF_UP))
                .entryType(entryType).referenceType(referenceType).referenceId(referenceId).actorId(actorId)
                .memo(memo != null && memo.length() > 300 ? memo.substring(0, 300) : memo).build());
    }

    public record Line(String account, BigDecimal stored, BigDecimal ledger, BigDecimal difference, boolean ok) {}

    @Transactional(readOnly = true)
    public List<Line> reconcile(Long chamaId) {
        Chama chama = chamaRepository.findById(chamaId).orElseThrow(() -> new IllegalArgumentException("Chama not found"));
        List<Line> lines = new ArrayList<>();
        lines.add(line(LedgerEntry.CHAMA_FUND, chama.getCurrentFund(), ledgerRepository.balance(chamaId, LedgerEntry.CHAMA_FUND)));
        BigDecimal welfare = welfareFundRepository.findByChamaChamaId(chamaId).map(WelfareFund::getBalance).orElse(BigDecimal.ZERO);
        lines.add(line(LedgerEntry.WELFARE_FUND, welfare, ledgerRepository.balance(chamaId, LedgerEntry.WELFARE_FUND)));
        return lines;
    }

    private static Line line(String account, BigDecimal stored, BigDecimal ledger) {
        BigDecimal s = (stored == null ? BigDecimal.ZERO : stored).setScale(2, RoundingMode.HALF_UP);
        BigDecimal l = (ledger == null ? BigDecimal.ZERO : ledger).setScale(2, RoundingMode.HALF_UP);
        return new Line(account, s, l, s.subtract(l), s.compareTo(l) == 0);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> report(Long chamaId, Long actorId) {
        ChamaMember m = chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, actorId).filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new AccessDeniedException("You are not an active member of this chama"));
        String role = m.getRole() == null ? "" : m.getRole().toUpperCase();
        if (!List.of("CHAIRPERSON", "TREASURER", "SECRETARY").contains(role)) throw new AccessDeniedException("Only chama officials can see the ledger");
        List<Line> lines = reconcile(chamaId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("balanced", lines.stream().allMatch(Line::ok));
        out.put("accounts", lines.stream().map(l -> {
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("account", l.account()); a.put("stored_balance", l.stored()); a.put("ledger_balance", l.ledger());
            a.put("difference", l.difference()); a.put("ok", l.ok());
            return a;
        }).toList());
        out.put("recent_entries", ledgerRepository.findTop100ByChamaChamaIdOrderByEntryIdDesc(chamaId).stream().map(e -> {
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("entry_id", e.getEntryId()); a.put("account", e.getAccount()); a.put("amount", e.getAmount());
            a.put("type", e.getEntryType()); a.put("reference_type", e.getReferenceType()); a.put("reference_id", e.getReferenceId());
            a.put("actor_id", e.getActorId()); a.put("memo", e.getMemo()); a.put("created_at", e.getCreatedAt());
            return a;
        }).toList());
        return out;
    }

    /** Every night: compare each chama's stored balances with its journal and shout if they differ. */
    @Scheduled(cron = "0 30 2 * * *")
    @Transactional(readOnly = true)
    public void nightlyReconciliation() {
        int bad = 0;
        for (Chama c : chamaRepository.findAll()) {
            for (Line l : reconcile(c.getChamaId())) {
                if (!l.ok()) {
                    bad++;
                    log.error("LEDGER MISMATCH chama={} account={} stored={} ledger={} difference={}", c.getChamaId(), l.account(), l.stored(), l.ledger(), l.difference());
                }
            }
        }
        if (bad == 0) log.info("Ledger reconciliation: every fund agrees with its journal");
    }
}
