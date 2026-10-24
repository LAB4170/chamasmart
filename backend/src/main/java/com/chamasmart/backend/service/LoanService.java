package com.chamasmart.backend.service;
import lombok.extern.slf4j.Slf4j;
import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.stream.Collectors;
@Service
@RequiredArgsConstructor
@Slf4j
public class LoanService {
    private static final BigDecimal MIN_LOAN = BigDecimal.valueOf(500);
    private final LoanRepository loanRepository;
    private final LoanGuarantorRepository loanGuarantorRepository;
    private final ChamaRepository chamaRepository;
    private final UserRepository userRepository;
    private final ChamaMemberRepository chamaMemberRepository;
    private final FinancialAuditLogRepository auditLogRepository;
    private final LoanConfigRepository loanConfigRepository;
    private final LoanRepaymentRepository loanRepaymentRepository;
    private ChamaMember validateUserMembershipAndActiveStatus(Long chamaId, Long userId) {
        return chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, userId)
                .filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("Security Violation: User ID " + userId + " is not an active member of Chama ID " + chamaId));
    }
    private ChamaMember validateUserIsOfficial(Long chamaId, Long userId) {
        ChamaMember member = validateUserMembershipAndActiveStatus(chamaId, userId);
        if (!"CHAIRPERSON".equalsIgnoreCase(member.getRole()) && !"TREASURER".equalsIgnoreCase(member.getRole()) && !"SECRETARY".equalsIgnoreCase(member.getRole())) {
            throw new org.springframework.security.access.AccessDeniedException("Security Violation: User ID " + userId + " lacks official administrative privileges for Chama ID " + chamaId);
        }
        return member;
    }
    /** Rules for a chama: the officials' saved config, or the defaults until one is saved. */
    @Transactional(readOnly = true)
    public LoanConfig getConfig(Long chamaId, Long requesterUserId) {
        validateUserMembershipAndActiveStatus(chamaId, requesterUserId);
        return configFor(chamaId);
    }

    private LoanConfig configFor(Long chamaId) {
        return loanConfigRepository.findByChamaId(chamaId).orElseGet(() -> LoanConfig.defaults(chamaId));
    }

    @Transactional
    public LoanConfig updateConfig(Long chamaId, Long officerUserId, BigDecimal rate, String type, BigDecimal multiplier, Integer maxMonths, Boolean requireGuarantors) {
        validateUserIsOfficial(chamaId, officerUserId);
        if (rate == null || rate.signum() < 0 || rate.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new IllegalArgumentException("Interest rate must be between 0 and 100");
        }
        if (type == null || !LoanCalculator.isSupportedType(type)) {
            throw new IllegalArgumentException("Interest type must be FLAT or REDUCING_BALANCE");
        }
        if (multiplier == null || multiplier.signum() <= 0 || multiplier.compareTo(BigDecimal.valueOf(20)) > 0) {
            throw new IllegalArgumentException("Loan multiplier must be greater than 0 and at most 20");
        }
        if (maxMonths == null || maxMonths < 1 || maxMonths > 60) {
            throw new IllegalArgumentException("Maximum repayment period must be between 1 and 60 months");
        }
        LoanConfig cfg = loanConfigRepository.findByChamaId(chamaId).orElseGet(() -> LoanConfig.defaults(chamaId));
        cfg.setInterestRate(rate);
        cfg.setInterestType(type);
        cfg.setLoanMultiplier(multiplier);
        cfg.setMaxRepaymentMonths(maxMonths);
        if (requireGuarantors != null) cfg.setRequireGuarantors(requireGuarantors);
        cfg.setUpdatedAt(ZonedDateTime.now());
        cfg.setUpdatedBy(officerUserId);
        return loanConfigRepository.save(cfg);
    }


    private static final List<String> OPEN_LOAN_STATES = List.of("PENDING", "APPROVED", "DISBURSED", "ACTIVE", "DEFAULTED");

    /** Principal a member still owes in this chama: each open loan's amount, scaled down by how much of it is repaid. */
    static BigDecimal outstandingPrincipal(List<Loan> loans, Long chamaId) {
        BigDecimal sum = BigDecimal.ZERO;
        for (Loan l : loans) {
            if (l.getChama() == null || !chamaId.equals(l.getChama().getChamaId())) continue;
            if (!OPEN_LOAN_STATES.contains(String.valueOf(l.getStatus()).toUpperCase())) continue;
            BigDecimal total = l.getTotalRepayable();
            BigDecimal paid = l.getAmountPaid() != null ? l.getAmountPaid() : BigDecimal.ZERO;
            if (total == null || total.signum() <= 0) { sum = sum.add(l.getLoanAmount()); continue; }
            BigDecimal unpaidShare = BigDecimal.ONE.subtract(paid.divide(total, 8, RoundingMode.HALF_UP)).max(BigDecimal.ZERO);
            sum = sum.add(l.getLoanAmount().multiply(unpaidShare));
        }
        return sum;
    }


    @Transactional
    public LoanSummaryDto applyForLoan(LoanApplicationRequestDto request, Long borrowerUserId) {
        log.info("Processing loan application for user ID: {} in chama ID: {}", borrowerUserId, request.getChama_id());
        if (request.getChama_id() == null) {
            throw new IllegalArgumentException("Chama is required");
        }
        ChamaMember borrowerMembership = validateUserMembershipAndActiveStatus(request.getChama_id(), borrowerUserId);
        User borrower = userRepository.findById(borrowerUserId)
                .orElseThrow(() -> new RuntimeException("Borrower user not found"));
        Chama chama = chamaRepository.findById(request.getChama_id())
                .orElseThrow(() -> new RuntimeException("Chama not found"));
        LoanConfig cfg = configFor(chama.getChamaId());

        BigDecimal principal = request.getLoan_amount();
        if (principal == null || principal.compareTo(MIN_LOAN) < 0) {
            throw new IllegalArgumentException("The minimum loan is KES " + MIN_LOAN.toPlainString());
        }
        Integer term = request.getTerm_months();
        if (term == null || term < 1 || term > cfg.getMaxRepaymentMonths()) {
            throw new IllegalArgumentException("Repayment period must be between 1 and " + cfg.getMaxRepaymentMonths() + " months");
        }
        // Borrowing limit = total contributions x multiplier, minus what the member still owes on open loans.
        // ASCA limits are share-based and are not enforced here.
        List<Loan> myLoans = loanRepository.findByBorrowerUserId(borrowerUserId);
        if (myLoans.stream().anyMatch(l -> "DEFAULTED".equalsIgnoreCase(l.getStatus()))) {
            throw new IllegalArgumentException("You have a defaulted loan. Clear it before applying for another");
        }
        if (!"ASCA".equalsIgnoreCase(chama.getChamaType())) {
            BigDecimal savings = borrowerMembership.getTotalContributions() != null ? borrowerMembership.getTotalContributions() : BigDecimal.ZERO;
            BigDecimal gross = savings.multiply(cfg.getLoanMultiplier());
            BigDecimal outstanding = outstandingPrincipal(myLoans, chama.getChamaId());
            BigDecimal limit = gross.subtract(outstanding).max(BigDecimal.ZERO);
            if (principal.compareTo(limit) > 0) {
                throw new IllegalArgumentException("You can borrow up to KES " + limit.setScale(2, RoundingMode.HALF_UP).toPlainString() + " ("
                        + cfg.getLoanMultiplier().stripTrailingZeros().toPlainString() + "x your contributions, less KES "
                        + outstanding.setScale(2, RoundingMode.HALF_UP).toPlainString() + " you still owe on open loans)");
            }
        }

        BigDecimal interest = LoanCalculator.totalInterest(principal, cfg.getInterestRate(), term, cfg.getInterestType());
        BigDecimal totalRepayable = principal.add(interest);
        BigDecimal monthlyPayment = totalRepayable.divide(BigDecimal.valueOf(term), 2, RoundingMode.HALF_UP);

        // Validate guarantor pledges before anything is saved.
        List<LoanApplicationRequestDto.GuarantorPledgeDto> pledges = request.getGuarantors() != null ? request.getGuarantors() : List.of();
        Set<Long> seen = new HashSet<>();
        BigDecimal covered = BigDecimal.ZERO;
        for (LoanApplicationRequestDto.GuarantorPledgeDto pledge : pledges) {
            if (pledge.getUser_id() == null || pledge.getGuarantee_amount() == null || pledge.getGuarantee_amount().signum() <= 0) {
                throw new IllegalArgumentException("Each guarantor needs a member and an amount greater than zero");
            }
            if (pledge.getUser_id().equals(borrowerUserId)) {
                throw new IllegalArgumentException("You cannot guarantee your own loan");
            }
            if (!seen.add(pledge.getUser_id())) {
                throw new IllegalArgumentException("A member can only be added as a guarantor once");
            }
            ChamaMember gm = chamaMemberRepository.findByChamaChamaIdAndUserUserId(chama.getChamaId(), pledge.getUser_id())
                    .filter(ChamaMember::getIsActive)
                    .orElseThrow(() -> new IllegalArgumentException("Guarantors must be active members of this chama"));
            if (loanRepository.findByBorrowerUserId(pledge.getUser_id()).stream()
                    .anyMatch(l -> "DEFAULTED".equalsIgnoreCase(l.getStatus()))) {
                throw new IllegalArgumentException("A member with a defaulted loan cannot guarantee another loan");
            }
            // Capacity: total pledged across open loans may not exceed savings x multiplier.
            BigDecimal savings = gm.getTotalContributions() != null ? gm.getTotalContributions() : BigDecimal.ZERO;
            BigDecimal alreadyPledged = loanGuarantorRepository.findByGuarantorUserUserId(pledge.getUser_id()).stream()
                    .filter(g -> List.of("PENDING", "APPROVED").contains(g.getStatus()))
                    .filter(g -> List.of("PENDING", "APPROVED", "DISBURSED", "ACTIVE", "DEFAULTED").contains(g.getLoan().getStatus()))
                    .map(LoanGuarantor::getGuaranteeAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal capacity = savings.multiply(cfg.getLoanMultiplier()).subtract(alreadyPledged);
            if (pledge.getGuarantee_amount().compareTo(capacity) > 0) {
                throw new IllegalArgumentException("A guarantor can pledge at most " + cfg.getLoanMultiplier().stripTrailingZeros().toPlainString() + "x their contributions across all open loans; one of your guarantors has KES " + capacity.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP).toPlainString() + " left");
            }
            covered = covered.add(pledge.getGuarantee_amount());
        }
        if (Boolean.TRUE.equals(cfg.getRequireGuarantors()) && covered.compareTo(totalRepayable) < 0) {
            throw new IllegalArgumentException("Guarantors must cover the full repayable amount of KES " + totalRepayable.toPlainString());
        }

        Loan loan = Loan.builder()
                .chama(chama)
                .borrower(borrower)
                .loanAmount(principal)
                .termMonths(term)
                .purpose(request.getPurpose())
                .interestRate(cfg.getInterestRate())
                .interestType(cfg.getInterestType())
                .totalRepayable(totalRepayable)
                .monthlyPayment(monthlyPayment)
                .dueDate(LocalDate.now().plusMonths(term))
                .status("PENDING")
                .guarantorRequired(!pledges.isEmpty())
                .collateralDescription(request.getCollateral_description())
                .amountPaid(BigDecimal.ZERO)
                .build();
        Loan savedLoan = loanRepository.save(loan);

        for (LoanApplicationRequestDto.GuarantorPledgeDto pledge : pledges) {
            User guarantorUser = userRepository.findById(pledge.getUser_id())
                    .orElseThrow(() -> new IllegalArgumentException("Guarantor user not found"));
            loanGuarantorRepository.save(LoanGuarantor.builder()
                    .loan(savedLoan)
                    .guarantorUser(guarantorUser)
                    .guaranteeAmount(pledge.getGuarantee_amount())
                    .status("PENDING")
                    .build());
        }
        log.info("Successfully created loan ID: {}", savedLoan.getLoanId());
        return LoanSummaryDto.fromEntity(savedLoan);
    }

    @Transactional(readOnly = true)
    public List<LoanSummaryDto> getMyLoans(Long borrowerUserId) {
        log.info("Fetching loans for borrower ID: {}", borrowerUserId);
        return loanRepository.findByBorrowerUserId(borrowerUserId).stream()
                .map(LoanSummaryDto::fromEntity)
                .collect(Collectors.toList());
    }
    private static boolean isOfficial(ChamaMember m) {
        String r = m.getRole() == null ? "" : m.getRole().toUpperCase();
        return r.equals("CHAIRPERSON") || r.equals("TREASURER") || r.equals("SECRETARY");
    }

    /**
     * Loans of one chama. Requires active membership. Officers see every loan in the chama;
     * ordinary members see only their own loans.
     */
    @Transactional(readOnly = true)
    public List<LoanSummaryDto> getChamaLoans(Long chamaId, Long requesterUserId) {
        ChamaMember member = validateUserMembershipAndActiveStatus(chamaId, requesterUserId);
        boolean official = isOfficial(member);
        Set<Long> guaranteed = loanGuarantorRepository.findByGuarantorUserUserId(requesterUserId).stream()
                .map(g -> g.getLoan().getLoanId()).collect(Collectors.toSet());
        return loanRepository.findByChamaChamaId(chamaId).stream()
                .filter(l -> official || l.getBorrower().getUserId().equals(requesterUserId))
                .map(l -> withFlags(LoanSummaryDto.fromEntity(l), requesterUserId, guaranteed.contains(l.getLoanId())))
                .collect(Collectors.toList());
    }

    private static LoanSummaryDto withFlags(LoanSummaryDto dto, Long requesterUserId, boolean guarantor) {
        dto.setIs_borrower(dto.getBorrower_id().equals(requesterUserId));
        dto.setIs_guarantor(guarantor);
        return dto;
    }

    /**
     * One loan with its repayment schedule and guarantors. Visible to officers, the borrower, and the loan's guarantors.
     * The schedule is derived from the loan's own terms (it is not stored): instalments sum exactly to the repayable total,
     * and an instalment counts as paid once cumulative payments cover it.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getLoanDetail(Long chamaId, Long loanId, Long requesterUserId) {
        ChamaMember member = validateUserMembershipAndActiveStatus(chamaId, requesterUserId);
        Loan loan = loanRepository.findById(loanId)
                .filter(l -> l.getChama().getChamaId().equals(chamaId))
                .orElseThrow(() -> new RuntimeException("Loan not found"));
        List<LoanGuarantor> guarantors = loanGuarantorRepository.findByLoanLoanId(loanId);
        boolean isBorrower = loan.getBorrower().getUserId().equals(requesterUserId);
        boolean isGuarantor = guarantors.stream().anyMatch(g -> g.getGuarantorUser().getUserId().equals(requesterUserId));
        if (!isOfficial(member) && !isBorrower && !isGuarantor) {
            throw new org.springframework.security.access.AccessDeniedException("You can only view loans you are involved in");
        }
        LoanSummaryDto dto = withFlags(LoanSummaryDto.fromEntity(loan), requesterUserId, isGuarantor);

        List<Map<String, Object>> schedule = new ArrayList<>();
        if (List.of("APPROVED", "DISBURSED", "ACTIVE", "DEFAULTED", "COMPLETED").contains(loan.getStatus()) && loan.getTermMonths() != null && loan.getTotalRepayable() != null) {
            String type = loan.getInterestType() != null ? loan.getInterestType() : LoanCalculator.FLAT;
            LocalDate start = (loan.getApprovedAt() != null ? loan.getApprovedAt() : loan.getCreatedAt()).toLocalDate();
            BigDecimal interest = loan.getTotalRepayable().subtract(loan.getLoanAmount());
            BigDecimal paid = loan.getAmountPaid() != null ? loan.getAmountPaid() : BigDecimal.ZERO;
            BigDecimal cumulative = BigDecimal.ZERO;
            for (LoanCalculator.Installment i : LoanCalculator.schedule(loan.getLoanAmount(), loan.getInterestRate(), loan.getTermMonths(), type, start, interest)) {
                cumulative = cumulative.add(i.total());
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("installment_number", i.number());
                row.put("due_date", i.dueDate());
                row.put("total_amount", i.total());
                row.put("principal_amount", i.principal());
                row.put("interest_amount", i.interest());
                row.put("balance", i.balanceAfter());
                row.put("status", paid.compareTo(cumulative) >= 0 ? "PAID" : "PENDING");
                schedule.add(row);
            }
        }

        List<Map<String, Object>> gs = new ArrayList<>();
        for (LoanGuarantor g : guarantors) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("guarantor_user_id", g.getGuarantorUser().getUserId());
            row.put("guarantor_name", g.getGuarantorUser().getFirstName() + " " + g.getGuarantorUser().getLastName());
            row.put("guarantee_amount", g.getGuaranteeAmount());
            row.put("status", "APPROVED".equals(g.getStatus()) ? "ACCEPTED" : g.getStatus());
            gs.add(row);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("loan", dto);
        out.put("schedule", schedule);
        out.put("guarantors", gs);
        return out;
    }

    /** One loan of a chama, with the same visibility rules as {@link #getChamaLoans}. */
    @Transactional(readOnly = true)
    public LoanSummaryDto getChamaLoan(Long chamaId, Long loanId, Long requesterUserId) {
        ChamaMember member = validateUserMembershipAndActiveStatus(chamaId, requesterUserId);
        Loan loan = loanRepository.findById(loanId)
                .filter(l -> l.getChama().getChamaId().equals(chamaId))
                .orElseThrow(() -> new RuntimeException("Loan not found"));
        if (!isOfficial(member) && !loan.getBorrower().getUserId().equals(requesterUserId)) {
            throw new org.springframework.security.access.AccessDeniedException("You can only view your own loans in this chama");
        }
        return LoanSummaryDto.fromEntity(loan);
    }

    @Transactional(readOnly = true)
    public List<GuarantorSummaryDto> getMyGuarantees(Long guarantorUserId) {
        log.info("Fetching guarantee requests for guarantor ID: {}", guarantorUserId);
        return loanGuarantorRepository.findByGuarantorUserUserId(guarantorUserId).stream()
                .map(GuarantorSummaryDto::fromEntity)
                .collect(Collectors.toList());
    }
    @Transactional
    public GuarantorSummaryDto respondToGuaranteeRequest(Long loanId, Long guarantorUserId, String decision) {
        log.info("Processing guarantor response for loan ID: {}, guarantor ID: {}, decision: {}", loanId, guarantorUserId, decision);
        LoanGuarantor lg = loanGuarantorRepository.findByLoanLoanIdAndGuarantorUserUserId(loanId, guarantorUserId)
                .orElseThrow(() -> new RuntimeException("Guarantee request not found"));
        validateUserMembershipAndActiveStatus(lg.getLoan().getChama().getChamaId(), guarantorUserId);
        if (!"PENDING".equals(lg.getStatus())) {
            throw new RuntimeException("Guarantee request has already been responded to");
        }
        if ("ACCEPT".equalsIgnoreCase(decision)) {
            lg.setStatus("APPROVED");
            lg.setApprovedAt(ZonedDateTime.now());
        } else {
            lg.setStatus("REJECTED");
        }
        LoanGuarantor updatedLg = loanGuarantorRepository.save(lg);
        // Check if all guarantors have approved
        List<LoanGuarantor> allGuarantors = loanGuarantorRepository.findByLoanLoanId(loanId);
        boolean allApproved = allGuarantors.stream().allMatch(g -> "APPROVED".equals(g.getStatus()));
        boolean anyRejected = allGuarantors.stream().anyMatch(g -> "REJECTED".equals(g.getStatus()));
        if (anyRejected || allApproved) {
            Loan loan = loanRepository.findByIdWithPessimisticLock(loanId)
                    .orElseThrow(() -> new RuntimeException("Loan not found"));
            if (anyRejected) {
                loan.setStatus("REJECTED");
                loan.setRejectionReason("One or more guarantors declined the guarantee pledge.");
                loan.setRejectedAt(ZonedDateTime.now());
            } else if (allApproved && !allGuarantors.isEmpty()) {
                log.info("All guarantors approved for loan ID: {}. Ready for disbursement.", loanId);
                // Loan remains PENDING administrative approval/disbursement
            }
            loanRepository.save(loan);
        }
        return GuarantorSummaryDto.fromEntity(updatedLg);
    }
    @Transactional
    public void approveLoan(Long loanId, Long officerUserId) {
        log.info("Officer ID {} approving loan ID: {}", officerUserId, loanId);
        Loan loan = loanRepository.findByIdWithPessimisticLock(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));
        if (!"PENDING".equalsIgnoreCase(loan.getStatus())) {
            throw new RuntimeException("Loan is not in a PENDING state. Current status: " + loan.getStatus());
        }
        Chama chama = chamaRepository.findByIdWithPessimisticLock(loan.getChama().getChamaId())
                .orElseThrow(() -> new RuntimeException("Chama not found"));
        validateUserIsOfficial(chama.getChamaId(), officerUserId);
        if (loan.getBorrower().getUserId().equals(officerUserId)) {
            throw new org.springframework.security.access.AccessDeniedException("You cannot approve your own loan; another official must do it");
        }
        List<LoanGuarantor> pledges = loanGuarantorRepository.findByLoanLoanId(loanId);
        if (pledges.stream().anyMatch(g -> !"APPROVED".equals(g.getStatus()))) {
            throw new IllegalStateException("Every guarantor must accept before this loan can be approved");
        }
        if (Boolean.TRUE.equals(configFor(chama.getChamaId()).getRequireGuarantors())) {
            BigDecimal covered = pledges.stream().map(LoanGuarantor::getGuaranteeAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            if (covered.compareTo(loan.getTotalRepayable()) < 0) {
                throw new IllegalStateException("Guarantor pledges do not cover the repayable amount");
            }
        }
        BigDecimal amount = loan.getLoanAmount();
        if (chama.getCurrentFund().compareTo(amount) < 0) {
            throw new RuntimeException("Insufficient chama funds for loan disbursement. Available: " 
                    + chama.getCurrentFund() + ", Requested: " + amount);
        }
        // Deduct from chama funds
        chama.setCurrentFund(chama.getCurrentFund().subtract(amount));
        chamaRepository.save(chama);
        loan.setStatus("APPROVED");
        loan.setApprovedAt(ZonedDateTime.now());
        loan.setApprovedBy(userRepository.getReferenceById(officerUserId));
        loanRepository.save(loan);
        // Write Financial Audit Log
        FinancialAuditLog auditLog = FinancialAuditLog.builder()
                .user(userRepository.getReferenceById(officerUserId))
                .transactionType("LOAN_DISBURSEMENT")
                .amount(amount)
                .chama(chama)
                .referenceId(loan.getLoanId())
                .description("Loan approved and disbursed. Borrower ID: " + loan.getBorrower().getUserId() + ", Amount: KES " + amount)
                .ipAddress("127.0.0.1")
                .userAgent("System-Service")
                .build();
        auditLogRepository.save(auditLog);
    }
    @Transactional
    public void rejectLoan(Long loanId, Long officerUserId, String reason) {
        log.info("Officer ID {} rejecting loan ID: {} with reason: {}", officerUserId, loanId, reason);
        Loan loan = loanRepository.findByIdWithPessimisticLock(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));
        if (!"PENDING".equalsIgnoreCase(loan.getStatus())) {
            throw new RuntimeException("Loan is not in a PENDING state. Current status: " + loan.getStatus());
        }
        validateUserIsOfficial(loan.getChama().getChamaId(), officerUserId);
        loan.setStatus("REJECTED");
        loan.setRejectionReason(reason != null ? reason : "Administrative rejection.");
        loan.setRejectedAt(ZonedDateTime.now());
        loan.setRejectedBy(userRepository.getReferenceById(officerUserId));
        loanRepository.save(loan);
    }
    /**
     * A borrower reports a repayment. Nothing is credited here: the loan balance and the chama fund
     * move only when an official other than the payer verifies it.
     */
    @Transactional
    public LoanRepayment repayLoan(Long loanId, BigDecimal amount, Long payerUserId) {
        log.info("Payer ID {} submitting repayment of KES {} for loan ID: {}", payerUserId, amount, loanId);
        Loan loan = loanRepository.findByIdWithPessimisticLock(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));
        if (!List.of("APPROVED", "DISBURSED", "ACTIVE", "DEFAULTED").contains(String.valueOf(loan.getStatus()).toUpperCase())) {
            throw new IllegalStateException("This loan cannot be repaid. Current status: " + loan.getStatus());
        }
        validateUserMembershipAndActiveStatus(loan.getChama().getChamaId(), payerUserId);
        boolean isBorrower = loan.getBorrower().getUserId().equals(payerUserId);
        boolean guarantorOfDefault = "DEFAULTED".equalsIgnoreCase(loan.getStatus())
                && loanGuarantorRepository.findByLoanLoanIdAndGuarantorUserUserId(loanId, payerUserId)
                        .filter(g -> "APPROVED".equals(g.getStatus())).isPresent();
        if (!isBorrower && !guarantorOfDefault) {
            throw new org.springframework.security.access.AccessDeniedException("Only the borrower (or a guarantor of a defaulted loan) can repay this loan");
        }
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException("Repayment amount must be greater than zero");
        }
        BigDecimal currentPaid = loan.getAmountPaid() != null ? loan.getAmountPaid() : BigDecimal.ZERO;
        BigDecimal awaiting = loanRepaymentRepository.findByLoanId(loanId).stream()
                .filter(r -> "PENDING".equals(r.getStatus()))
                .map(LoanRepayment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal remaining = loan.getTotalRepayable().subtract(currentPaid).subtract(awaiting);
        if (amount.compareTo(remaining) > 0) {
            throw new IllegalArgumentException("Repayment exceeds the outstanding balance of KES " + remaining.max(BigDecimal.ZERO).toPlainString()
                    + (awaiting.signum() > 0 ? " (KES " + awaiting.toPlainString() + " is already waiting for verification)" : ""));
        }
        LoanRepayment saved = loanRepaymentRepository.save(LoanRepayment.builder()
                .loan(loan).payer(userRepository.getReferenceById(payerUserId)).amount(amount).status("PENDING").build());
        auditLogRepository.save(FinancialAuditLog.builder()
                .user(userRepository.getReferenceById(payerUserId))
                .transactionType("LOAN_REPAYMENT_SUBMITTED")
                .amount(amount)
                .chama(loan.getChama())
                .referenceId(loan.getLoanId())
                .description("Repayment reported and waiting for verification. Loan ID: " + loan.getLoanId())
                .ipAddress("127.0.0.1")
                .userAgent("System-Service")
                .build());
        return saved;
    }

    /** An official other than the payer confirms the money arrived; only now do the loan and the fund move. */
    @Transactional
    public void verifyRepayment(Long chamaId, Long repaymentId, Long officialUserId) {
        LoanRepayment rep = loanRepaymentRepository.findById(repaymentId)
                .orElseThrow(() -> new RuntimeException("Repayment not found"));
        Loan loan = loanRepository.findByIdWithPessimisticLock(rep.getLoan().getLoanId())
                .orElseThrow(() -> new RuntimeException("Loan not found"));
        if (!chamaId.equals(loan.getChama().getChamaId())) {
            throw new RuntimeException("Repayment not found");
        }
        validateUserIsOfficial(chamaId, officialUserId);
        if (rep.getPayer().getUserId().equals(officialUserId)) {
            throw new org.springframework.security.access.AccessDeniedException("You cannot verify your own repayment; another official must do it");
        }
        if (!"PENDING".equals(rep.getStatus())) {
            throw new IllegalStateException("This repayment has already been " + String.valueOf(rep.getStatus()).toLowerCase());
        }
        BigDecimal currentPaid = loan.getAmountPaid() != null ? loan.getAmountPaid() : BigDecimal.ZERO;
        if (rep.getAmount().compareTo(loan.getTotalRepayable().subtract(currentPaid)) > 0) {
            throw new IllegalStateException("This repayment is larger than what is still owed on the loan");
        }
        Chama chama = chamaRepository.findByIdWithPessimisticLock(chamaId)
                .orElseThrow(() -> new RuntimeException("Chama not found"));
        loan.setAmountPaid(currentPaid.add(rep.getAmount()));
        loan.setLastPaymentDate(ZonedDateTime.now());
        chama.setCurrentFund(chama.getCurrentFund().add(rep.getAmount()));
        chamaRepository.save(chama);
        if (loan.getAmountPaid().compareTo(loan.getTotalRepayable()) >= 0) {
            loan.setStatus("COMPLETED");
        }
        loanRepository.save(loan);
        rep.setStatus("VERIFIED");
        rep.setDecidedBy(userRepository.getReferenceById(officialUserId));
        rep.setDecidedAt(ZonedDateTime.now());
        loanRepaymentRepository.save(rep);
        auditLogRepository.save(FinancialAuditLog.builder()
                .user(userRepository.getReferenceById(officialUserId))
                .transactionType("LOAN_REPAYMENT")
                .amount(rep.getAmount())
                .chama(chama)
                .referenceId(loan.getLoanId())
                .description("Repayment verified. Loan ID: " + loan.getLoanId() + ", payer ID: " + rep.getPayer().getUserId() + ", amount: KES " + rep.getAmount())
                .ipAddress("127.0.0.1")
                .userAgent("System-Service")
                .build());
    }

    @Transactional
    public void rejectRepayment(Long chamaId, Long repaymentId, Long officialUserId, String reason) {
        LoanRepayment rep = loanRepaymentRepository.findById(repaymentId)
                .orElseThrow(() -> new RuntimeException("Repayment not found"));
        Loan loan = loanRepository.findByIdWithPessimisticLock(rep.getLoan().getLoanId())
                .orElseThrow(() -> new RuntimeException("Loan not found"));
        if (!chamaId.equals(loan.getChama().getChamaId())) {
            throw new RuntimeException("Repayment not found");
        }
        validateUserIsOfficial(chamaId, officialUserId);
        if (!"PENDING".equals(rep.getStatus())) {
            throw new IllegalStateException("This repayment has already been " + String.valueOf(rep.getStatus()).toLowerCase());
        }
        rep.setStatus("REJECTED");
        rep.setDecidedBy(userRepository.getReferenceById(officialUserId));
        rep.setDecidedAt(ZonedDateTime.now());
        rep.setDecisionNote(reason);
        loanRepaymentRepository.save(rep);
        auditLogRepository.save(FinancialAuditLog.builder()
                .user(userRepository.getReferenceById(officialUserId))
                .transactionType("LOAN_REPAYMENT_REJECTED")
                .amount(rep.getAmount())
                .chama(loan.getChama())
                .referenceId(loan.getLoanId())
                .description("Repayment rejected. Loan ID: " + loan.getLoanId() + (reason != null ? ", reason: " + reason : ""))
                .ipAddress("127.0.0.1")
                .userAgent("System-Service")
                .build());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> pendingRepayments(Long chamaId, Long officialUserId) {
        validateUserIsOfficial(chamaId, officialUserId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (LoanRepayment r : loanRepaymentRepository.findByChamaId(chamaId)) {
            if (!"PENDING".equals(r.getStatus())) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("repayment_id", r.getRepaymentId());
            m.put("loan_id", r.getLoan().getLoanId());
            m.put("amount", r.getAmount());
            m.put("payer_id", r.getPayer().getUserId());
            m.put("payer_name", (r.getPayer().getFirstName() + " " + r.getPayer().getLastName()).trim());
            m.put("created_at", r.getCreatedAt());
            m.put("own", r.getPayer().getUserId().equals(officialUserId));
            out.add(m);
        }
        return out;
    }

    /** Portfolio figures for officials, computed from the chama's actual loans. */
    @Transactional(readOnly = true)
    public java.util.Map<String, Object> analytics(Long chamaId, Long actorId) {
        ChamaMember me = chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, actorId)
                .filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("You are not an active member of this chama"));
        if (!java.util.List.of("CHAIRPERSON", "TREASURER", "SECRETARY").contains(String.valueOf(me.getRole()).toUpperCase())) {
            throw new org.springframework.security.access.AccessDeniedException("Only officials can view loan analytics");
        }
        java.util.List<Loan> loans = loanRepository.findByChamaChamaId(chamaId);
        java.util.Map<String, Long> byStatus = new java.util.TreeMap<>();
        BigDecimal disbursed = BigDecimal.ZERO, repaid = BigDecimal.ZERO, outstanding = BigDecimal.ZERO, defaulted = BigDecimal.ZERO;
        for (Loan l : loans) {
            byStatus.merge(String.valueOf(l.getStatus()), 1L, Long::sum);
            String st = String.valueOf(l.getStatus());
            boolean out = st.equals("DISBURSED") || st.equals("ACTIVE") || st.equals("APPROVED") || st.equals("DEFAULTED") || st.equals("COMPLETED");
            if (!out) continue;
            BigDecimal principal = l.getApprovedAmount() != null ? l.getApprovedAmount() : l.getLoanAmount();
            disbursed = disbursed.add(principal == null ? BigDecimal.ZERO : principal);
            repaid = repaid.add(l.getAmountPaid() == null ? BigDecimal.ZERO : l.getAmountPaid());
            if (!st.equals("COMPLETED") && l.getBalance() != null) outstanding = outstanding.add(l.getBalance());
            if (st.equals("DEFAULTED") && l.getBalance() != null) defaulted = defaulted.add(l.getBalance());
        }
        java.util.Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("total_loans", loans.size());
        out.put("by_status", byStatus);
        out.put("total_disbursed", disbursed);
        out.put("total_repaid", repaid);
        out.put("outstanding_balance", outstanding);
        out.put("defaulted_balance", defaulted);
        out.put("default_rate_percent", outstanding.signum() == 0 ? BigDecimal.ZERO : defaulted.multiply(BigDecimal.valueOf(100)).divide(outstanding, 1, java.math.RoundingMode.HALF_UP));
        return out;
    }
}

