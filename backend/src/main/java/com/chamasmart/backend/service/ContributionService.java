package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.ContributionSummaryDto;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Manual contribution ledger: members submit receipts, officials record, verify and reverse.
 * Every money-moving path requires an active membership, and recording/verifying/reversing requires an official role.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ContributionService {
    private static final Set<String> TYPES = Set.of("REGULAR", "WELFARE", "FINE", "SHARE", "SPECIAL", "ROSCA", "ONE_TIME");
    private static final BigDecimal MAX_AMOUNT = new BigDecimal("10000000");

    private final ContributionRepository contributionRepository;
    private final ChamaRepository chamaRepository;
    private final UserRepository userRepository;
    private final ChamaMemberRepository chamaMemberRepository;
    private final FinancialAuditLogRepository auditLogRepository;
    private final WelfareFundRepository welfareFundRepository;
    private final LedgerService ledger;
    private final RoscaCycleRepository roscaCycleRepository;
    private final RoscaRosterRepository roscaRosterRepository;
    private final FineService fineService;

    /** Credits at or above this need a second official; below it, an official still cannot credit their own money. */
    @org.springframework.beans.factory.annotation.Value("${app.finance.dual-approval-threshold:10000}")
    private BigDecimal dualApprovalThreshold = BigDecimal.valueOf(10000);

    public record Entry(Long userId, BigDecimal amount, String reference, String type, String notes, String proof) {}

    private ChamaMember activeMember(Long chamaId, Long userId) {
        return chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, userId)
                .filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new AccessDeniedException("You are not an active member of this chama"));
    }

    private static boolean official(ChamaMember m) {
        String r = m.getRole() == null ? "" : m.getRole().toUpperCase();
        return r.equals("CHAIRPERSON") || r.equals("TREASURER") || r.equals("SECRETARY");
    }

    private ChamaMember activeOfficial(Long chamaId, Long userId) {
        ChamaMember m = activeMember(chamaId, userId);
        if (!official(m)) throw new AccessDeniedException("Only chama officials can do this");
        return m;
    }

    private static BigDecimal checkAmount(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) throw new IllegalArgumentException("Amount must be greater than zero");
        if (amount.compareTo(MAX_AMOUNT) > 0) throw new IllegalArgumentException("Amount is too large");
        return amount.setScale(2, RoundingMode.HALF_UP);
    }

    private static String checkType(String type) {
        String t = type == null || type.isBlank() ? "REGULAR" : type.trim().toUpperCase();
        if (!TYPES.contains(t)) throw new IllegalArgumentException("Unknown contribution type: " + type);
        return t;
    }

    private String uniqueReference(String supplied, String prefix) {
        String ref = supplied == null ? "" : supplied.replaceAll("\\s+", "").toUpperCase();
        if (ref.isEmpty()) return prefix + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        if (ref.length() > 100) throw new IllegalArgumentException("Reference is too long");
        if (contributionRepository.existsByReferenceIgnoreCase(ref)) throw new IllegalArgumentException("A contribution with reference " + ref + " already exists");
        return ref;
    }

    private void audit(Long actorId, Chama chama, Contribution c, String txType, String description) {
        auditLogRepository.save(FinancialAuditLog.builder()
                .user(userRepository.getReferenceById(actorId))
                .transactionType(txType)
                .amount(c.getAmount())
                .chama(chama)
                .referenceId(c.getContributionId())
                .description(description)
                .ipAddress(com.chamasmart.backend.security.ClientIp.current())
                .userAgent(com.chamasmart.backend.security.ClientIp.currentUserAgent())
                .build());
    }

    /** Credits the member's total and the chama (or welfare) fund. Fund rows are locked while they change. */
    private void credit(Chama chama, Contribution c, Long actorId) {
        Long chamaId = chama.getChamaId();
        if ("FINE".equalsIgnoreCase(c.getContributionType())) fineService.settle(chamaId, c.getUser().getUserId(), c.getAmount());
        chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, c.getUser().getUserId()).ifPresent(m -> {
            BigDecimal total = m.getTotalContributions() != null ? m.getTotalContributions() : BigDecimal.ZERO;
            m.setTotalContributions(total.add(c.getAmount()));
            m.setLastContributionDate(ZonedDateTime.now());
            chamaMemberRepository.save(m);
        });
        if (toWelfare(c)) {
            WelfareFund fund = welfareFundRepository.findByChamaIdWithPessimisticLock(chamaId)
                    .orElseGet(() -> welfareFundRepository.save(WelfareFund.builder().chama(chama).balance(BigDecimal.ZERO).build()));
            fund.setBalance(fund.getBalance().add(c.getAmount()));
            welfareFundRepository.save(fund);
            ledger.post(chama, LedgerEntry.WELFARE_FUND, c.getAmount(), "CONTRIBUTION", "CONTRIBUTION", c.getContributionId(), actorId, "Welfare contribution " + c.getReference());
        } else {
            Chama locked = chamaRepository.findByIdWithPessimisticLock(chamaId).orElse(chama);
            locked.setCurrentFund(locked.getCurrentFund().add(c.getAmount()));
            chamaRepository.save(locked);
            ledger.post(locked, LedgerEntry.CHAMA_FUND, c.getAmount(), "CONTRIBUTION", "CONTRIBUTION", c.getContributionId(), actorId, "Contribution " + c.getReference());
        }
    }

    /** W-04: in a welfare chama every ordinary dues payment belongs to the one welfare fund; elsewhere only WELFARE-type payments do. */
    private static boolean toWelfare(Contribution c) {
        String t = c.getContributionType() == null ? "REGULAR" : c.getContributionType().toUpperCase();
        if ("WELFARE".equals(t)) return true;
        return c.getChama() != null && "WELFARE".equalsIgnoreCase(c.getChama().getChamaType()) && List.of("REGULAR", "ONE_TIME", "SPECIAL").contains(t);
    }

    private boolean needsSecondOfficial(Long actorId, Long targetId, BigDecimal amount) {
        return actorId.equals(targetId) || (amount != null && amount.compareTo(dualApprovalThreshold) >= 0);
    }

    private Contribution build(Chama chama, User user, Entry e, String status, String refPrefix) {
        String type = checkType(e.type());
        Long cycleId = "ROSCA".equals(type) ? resolveCycle(chama, user, e.notes()) : null;
        return Contribution.builder().chama(chama).user(user).amount(checkAmount(e.amount()))
                .reference(uniqueReference(e.reference(), refPrefix)).status(status).contributionType(type)
                .cycleId(cycleId).notes(e.notes()).paymentProof(com.chamasmart.backend.util.SafeUrl.https(e.proof(), "payment proof")).isDeleted(false).build();
    }

    private static final java.util.regex.Pattern CYCLE_TAG = java.util.regex.Pattern.compile("^\\[cycle:(\\d+)]");

    /**
     * M-09: a merry-go-round payment is linked to a cycle by the server. The cycle must belong to this chama, be active,
     * and have the payer on its roster. The client's note is only a hint for which cycle; it can never point at someone else's.
     */
    private Long resolveCycle(Chama chama, User payer, String notes) {
        RoscaCycle cycle = null;
        java.util.regex.Matcher m = notes == null ? null : CYCLE_TAG.matcher(notes.trim());
        if (m != null && m.find()) {
            cycle = roscaCycleRepository.findById(Long.parseLong(m.group(1))).orElse(null);
        } else {
            cycle = roscaCycleRepository.findByChamaChamaId(chama.getChamaId()).stream().filter(c -> "ACTIVE".equalsIgnoreCase(c.getStatus())).findFirst().orElse(null);
        }
        if (cycle == null || !cycle.getChama().getChamaId().equals(chama.getChamaId()) || !"ACTIVE".equalsIgnoreCase(cycle.getStatus())) {
            throw new IllegalArgumentException("There is no active merry-go-round cycle in this chama to pay into");
        }
        boolean onRoster = roscaRosterRepository.findByCycleCycleIdOrderByPositionAsc(cycle.getCycleId()).stream()
                .anyMatch(r -> r.getUser().getUserId().equals(payer.getUserId()) && !"SKIPPED".equalsIgnoreCase(r.getStatus()));
        if (!onRoster) throw new IllegalArgumentException("This member is not on the roster of the active cycle");
        return cycle.getCycleId();
    }

    /** An official records a payment already received; it is credited immediately. */
    @Transactional
    public ContributionSummaryDto record(Long chamaId, Long actorId, Entry e, boolean credited) {
        activeOfficial(chamaId, actorId);
        Chama chama = chamaRepository.findById(chamaId).orElseThrow(() -> new IllegalArgumentException("Chama not found"));
        Long targetId = e.userId() != null ? e.userId() : actorId;
        activeMember(chamaId, targetId);
        User user = userRepository.findById(targetId).orElseThrow(() -> new IllegalArgumentException("Member not found"));
        // Maker-checker: an official cannot credit their own money, and large amounts need a second official.
        boolean direct = credited && !needsSecondOfficial(actorId, targetId, e.amount());
        Contribution toSave = build(chama, user, e, direct ? "COMPLETED" : "PENDING", "REC");
        toSave.setRecordedBy(actorId);
        Contribution saved = contributionRepository.save(toSave);
        if (direct) {
            credit(chama, saved, actorId);
            audit(actorId, chama, saved, "MANUAL_CONTRIBUTION", "Manual contribution recorded. Reference: " + saved.getReference());
        }
        return ContributionSummaryDto.fromEntity(saved);
    }

    /** A member submits a receipt; nothing is credited until an official verifies it. */
    @Transactional
    public ContributionSummaryDto submit(Long chamaId, Long actorId, Entry e) {
        activeMember(chamaId, actorId);
        Chama chama = chamaRepository.findById(chamaId).orElseThrow(() -> new IllegalArgumentException("Chama not found"));
        User user = userRepository.findById(actorId).orElseThrow(() -> new IllegalArgumentException("User not found"));
        Contribution saved = contributionRepository.save(build(chama, user, e, "PENDING", "SUB"));
        return ContributionSummaryDto.fromEntity(saved);
    }

    /** All-or-nothing: if any line is invalid nothing is recorded. */
    @Transactional
    public List<ContributionSummaryDto> bulkRecord(Long chamaId, Long actorId, List<Entry> entries) {
        activeOfficial(chamaId, actorId);
        if (entries == null || entries.isEmpty()) throw new IllegalArgumentException("Add at least one contribution");
        if (entries.size() > 500) throw new IllegalArgumentException("A batch can hold at most 500 contributions");
        Chama chama = chamaRepository.findById(chamaId).orElseThrow(() -> new IllegalArgumentException("Chama not found"));
        Set<String> refsInBatch = new HashSet<>();
        List<ContributionSummaryDto> out = new ArrayList<>();
        for (Entry e : entries) {
            if (e.userId() == null) throw new IllegalArgumentException("Every line needs a member");
            if (e.reference() != null && !e.reference().isBlank() && !refsInBatch.add(e.reference().replaceAll("\\s+", "").toUpperCase())) {
                throw new IllegalArgumentException("Reference " + e.reference().trim() + " appears more than once in this batch");
            }
            activeMember(chamaId, e.userId());
            User user = userRepository.findById(e.userId()).orElseThrow(() -> new IllegalArgumentException("Member not found"));
            boolean direct = !needsSecondOfficial(actorId, e.userId(), e.amount());
            Contribution toSave = build(chama, user, e, direct ? "COMPLETED" : "PENDING", "BULK");
            toSave.setRecordedBy(actorId);
            Contribution saved = contributionRepository.save(toSave);
            if (direct) {
                credit(chama, saved, actorId);
                audit(actorId, chama, saved, "BULK_CONTRIBUTION", "Bulk contribution recorded. Member ID: " + e.userId() + ", Ref: " + saved.getReference());
            }
            out.add(ContributionSummaryDto.fromEntity(saved));
        }
        return out;
    }

    @Transactional
    public ContributionSummaryDto verify(Long chamaId, Long actorId, Long contributionId, boolean approve) {
        activeOfficial(chamaId, actorId);
        Contribution c = contributionRepository.findByIdWithPessimisticLock(contributionId)
                .filter(x -> x.getChama().getChamaId().equals(chamaId) && !Boolean.TRUE.equals(x.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("Contribution not found"));
        if (!"PENDING".equalsIgnoreCase(c.getStatus())) {
            throw new IllegalStateException("This contribution has already been " + c.getStatus().toLowerCase());
        }
        if (c.getUser().getUserId().equals(actorId)) {
            throw new AccessDeniedException("You cannot verify your own submission; another official must do it");
        }
        if (actorId.equals(c.getRecordedBy())) {
            throw new AccessDeniedException("You recorded this payment, so another official must verify it");
        }
        if (approve) {
            c.setStatus("COMPLETED");
            credit(c.getChama(), c, actorId);
            audit(actorId, c.getChama(), c, "VERIFIED_CONTRIBUTION", "Receipt contribution approved. Ref: " + c.getReference());
        } else {
            c.setStatus("FAILED");
            audit(actorId, c.getChama(), c, "REJECTED_CONTRIBUTION", "Receipt contribution rejected. Ref: " + c.getReference());
        }
        return ContributionSummaryDto.fromEntity(contributionRepository.save(c));
    }

    @Transactional(readOnly = true)
    public List<ContributionSummaryDto> pending(Long chamaId, Long actorId) {
        activeOfficial(chamaId, actorId);
        return contributionRepository.findByChamaChamaIdAndIsDeletedFalse(chamaId).stream()
                .filter(c -> "PENDING".equalsIgnoreCase(c.getStatus()))
                .map(ContributionSummaryDto::fromEntity).collect(Collectors.toList());
    }

    /** Officials see everything. Members see completed contributions of their chama plus their own pending or failed ones. */
    @Transactional(readOnly = true)
    public List<ContributionSummaryDto> list(Long chamaId, Long actorId, String startDate, String endDate) {
        boolean isOfficial = official(activeMember(chamaId, actorId));
        LocalDate from = startDate == null || startDate.isBlank() ? null : LocalDate.parse(startDate);
        LocalDate to = endDate == null || endDate.isBlank() ? null : LocalDate.parse(endDate);
        ZoneId zone = ZoneId.of("Africa/Nairobi");
        return contributionRepository.findByChamaChamaIdAndIsDeletedFalse(chamaId).stream()
                .filter(c -> isOfficial || "COMPLETED".equalsIgnoreCase(c.getStatus()) || c.getUser().getUserId().equals(actorId))
                .filter(c -> {
                    if (c.getContributionDate() == null) return true;
                    LocalDate d = c.getContributionDate().withZoneSameInstant(zone).toLocalDate();
                    return (from == null || !d.isBefore(from)) && (to == null || !d.isAfter(to));
                })
                .map(ContributionSummaryDto::fromEntity).collect(Collectors.toList());
    }

    @Transactional
    public void delete(Long chamaId, Long actorId, Long id, String reason) {
        activeOfficial(chamaId, actorId);
        Contribution c = contributionRepository.findByIdWithPessimisticLock(id)
                .filter(x -> x.getChama().getChamaId().equals(chamaId) && !Boolean.TRUE.equals(x.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("Contribution not found"));
        if ("COMPLETED".equalsIgnoreCase(c.getStatus())) {
            if (reason == null || reason.isBlank()) {
                throw new IllegalArgumentException("Give a reason for reversing a credited contribution");
            }
            if (c.getUser().getUserId().equals(actorId)) {
                throw new AccessDeniedException("You cannot reverse your own contribution; another official must do it");
            }
            // Never hide a shortfall: if the money has already been lent or paid out, the reversal must wait.
            if (toWelfare(c)) {
                BigDecimal bal = welfareFundRepository.findByChamaIdWithPessimisticLock(chamaId).map(WelfareFund::getBalance).orElse(BigDecimal.ZERO);
                if (bal.compareTo(c.getAmount()) < 0) throw new IllegalStateException("Reversing KES " + c.getAmount().toPlainString() + " would take the welfare fund below zero, because part of it has been paid out. Resolve the shortfall first");
            } else {
                BigDecimal bal = chamaRepository.findByIdWithPessimisticLock(chamaId).map(Chama::getCurrentFund).orElse(BigDecimal.ZERO);
                if (bal.compareTo(c.getAmount()) < 0) throw new IllegalStateException("Reversing KES " + c.getAmount().toPlainString() + " would take the fund below zero, because the money has already been lent or paid out. Resolve the shortfall first");
            }
            chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, c.getUser().getUserId()).ifPresent(m -> {
                m.setTotalContributions(m.getTotalContributions().subtract(c.getAmount()).max(BigDecimal.ZERO));
                chamaMemberRepository.save(m);
            });
            if (toWelfare(c)) {
                welfareFundRepository.findByChamaIdWithPessimisticLock(chamaId).ifPresent(f -> {
                    f.setBalance(f.getBalance().subtract(c.getAmount()).max(BigDecimal.ZERO));
                    welfareFundRepository.save(f);
                    ledger.post(c.getChama(), LedgerEntry.WELFARE_FUND, c.getAmount().negate(), "REVERSAL", "CONTRIBUTION", c.getContributionId(), actorId, "Reversed: " + reason.trim());
                });
            } else {
                Chama chama = chamaRepository.findByIdWithPessimisticLock(chamaId).orElse(c.getChama());
                chama.setCurrentFund(chama.getCurrentFund().subtract(c.getAmount()).max(BigDecimal.ZERO));
                chamaRepository.save(chama);
                ledger.post(chama, LedgerEntry.CHAMA_FUND, c.getAmount().negate(), "REVERSAL", "CONTRIBUTION", c.getContributionId(), actorId, "Reversed: " + reason.trim());
            }
            audit(actorId, c.getChama(), c, "CONTRIBUTION_REVERSAL", "Contribution reversed by an official. Original Ref: " + c.getReference() + ". Reason: " + reason.trim());
        }
        c.setIsDeleted(true);
        c.setDeletedReason(reason == null ? null : reason.trim());
        c.setDeletedAt(ZonedDateTime.now());
        contributionRepository.save(c);
    }
}
