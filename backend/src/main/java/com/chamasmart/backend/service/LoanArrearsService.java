package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/** M-10: overdue tracking, automatic default after a grace period, and the arrears list officials work from. */
@Service
@RequiredArgsConstructor
@Slf4j
public class LoanArrearsService {
    private static final List<String> LIVE = List.of("APPROVED", "DISBURSED", "ACTIVE", "DEFAULTED");

    private final LoanRepository loanRepository;
    private final LoanGuarantorRepository guarantorRepository;
    private final NotificationRepository notificationRepository;
    private final ChamaMemberRepository memberRepository;
    private final LoanScheduleService scheduleService;

    @Value("${app.loans.default-grace-days:30}")
    private int graceDays = 30;

    /** What a live loan should have paid by {@code today} and has not. Zero when the loan is not live. */
    public BigDecimal overdueAmount(Loan loan, LocalDate today) {
        if (!LIVE.contains(String.valueOf(loan.getStatus()).toUpperCase()) || loan.getTermMonths() == null || loan.getTotalRepayable() == null) return BigDecimal.ZERO;
        BigDecimal stored = scheduleService.overdue(loan, today);
        if (stored != null) return stored;
        BigDecimal paid = loan.getAmountPaid() == null ? BigDecimal.ZERO : loan.getAmountPaid();
        BigDecimal due = BigDecimal.ZERO;
        for (LoanCalculator.Installment i : schedule(loan)) {
            if (i.dueDate().isBefore(today)) due = due.add(i.total());
        }
        return due.subtract(paid).max(BigDecimal.ZERO);
    }

    private List<LoanCalculator.Installment> schedule(Loan loan) {
        String type = loan.getInterestType() != null ? loan.getInterestType() : LoanCalculator.FLAT;
        LocalDate start = (loan.getApprovedAt() != null ? loan.getApprovedAt() : loan.getCreatedAt()).toLocalDate();
        BigDecimal interest = loan.getTotalRepayable().subtract(loan.getLoanAmount());
        return LoanCalculator.schedule(loan.getLoanAmount(), loan.getInterestRate(), loan.getTermMonths(), type, start, interest);
    }

    private LocalDate finalDueDate(Loan loan) {
        LocalDate stored = scheduleService.lastDueDate(loan);
        if (stored != null) return stored;
        List<LoanCalculator.Installment> s = schedule(loan);
        return s.isEmpty() ? null : s.get(s.size() - 1).dueDate();
    }

    /** Marks loans DEFAULTED once the last instalment is past its grace period and money is still owed. Returns how many changed. */
    @Transactional
    public int markDefaults(LocalDate today) {
        int changed = 0;
        List<Loan> candidates = new ArrayList<>(loanRepository.findByStatus("DISBURSED"));
        candidates.addAll(loanRepository.findByStatus("APPROVED"));
        candidates.addAll(loanRepository.findByStatus("ACTIVE"));
        for (Loan loan : candidates) {
            if (loan.getTermMonths() == null || loan.getTotalRepayable() == null) continue;
            BigDecimal paid = loan.getAmountPaid() == null ? BigDecimal.ZERO : loan.getAmountPaid();
            if (paid.compareTo(loan.getTotalRepayable()) >= 0) continue;
            LocalDate last = finalDueDate(loan);
            if (last == null || !last.plusDays(graceDays).isBefore(today)) continue;
            loan.setStatus("DEFAULTED");
            loanRepository.save(loan);
            notifyAll(loan);
            changed++;
        }
        if (changed > 0) log.info("Marked {} loan(s) as defaulted", changed);
        return changed;
    }

    private void notifyAll(Loan loan) {
        String msg = "The loan of KES " + loan.getLoanAmount().toPlainString() + " in " + loan.getChama().getChamaName()
                + " is past its due date and grace period and is now marked as defaulted. Please contact your chama's officials.";
        Set<User> people = new LinkedHashSet<>();
        people.add(loan.getBorrower());
        for (LoanGuarantor g : guarantorRepository.findByLoanLoanId(loan.getLoanId())) {
            if ("APPROVED".equals(g.getStatus())) people.add(g.getGuarantorUser());
        }
        for (User u : people) {
            notificationRepository.save(Notification.builder().user(u).title("Loan marked as defaulted").message(msg)
                    .type("LOAN_DEFAULTED").entityType("LOAN").entityId(loan.getLoanId()).build());
        }
    }

    @Scheduled(cron = "0 15 2 * * *")
    public void nightly() {
        try { scheduleService.chargeLateFees(LocalDate.now()); markDefaults(LocalDate.now()); } catch (RuntimeException e) { log.error("Nightly default check failed", e); }
    }

    /** Officials only: live loans with money overdue, largest first. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> arrears(Long chamaId, Long actorId) {
        ChamaMember me = memberRepository.findByChamaChamaIdAndUserUserId(chamaId, actorId).filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new AccessDeniedException("You are not an active member of this chama"));
        String r = String.valueOf(me.getRole()).toUpperCase();
        if (!r.equals("CHAIRPERSON") && !r.equals("TREASURER") && !r.equals("SECRETARY")) throw new AccessDeniedException("Only officials can see arrears");
        LocalDate today = LocalDate.now();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Loan l : loanRepository.findByChamaChamaId(chamaId)) {
            BigDecimal overdue = overdueAmount(l, today);
            if (overdue.signum() <= 0) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("loan_id", l.getLoanId());
            row.put("borrower_id", l.getBorrower().getUserId());
            row.put("borrower_name", l.getBorrower().getFirstName() + " " + l.getBorrower().getLastName());
            row.put("status", l.getStatus());
            row.put("overdue_amount", overdue);
            row.put("final_due_date", finalDueDate(l));
            out.add(row);
        }
        out.sort((a, b) -> ((BigDecimal) b.get("overdue_amount")).compareTo((BigDecimal) a.get("overdue_amount")));
        return out;
    }
}
