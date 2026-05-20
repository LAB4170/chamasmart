package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class LoanService {

    private final LoanRepository loanRepository;
    private final LoanGuarantorRepository loanGuarantorRepository;
    private final ChamaRepository chamaRepository;
    private final UserRepository userRepository;
    private final ChamaMemberRepository chamaMemberRepository;
    private final FinancialAuditLogRepository auditLogRepository;

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

    @Transactional
    public LoanSummaryDto applyForLoan(LoanApplicationRequestDto request, Long borrowerUserId) {
        log.info("Processing loan application for user ID: {} in chama ID: {}", borrowerUserId, request.getChama_id());

        validateUserMembershipAndActiveStatus(request.getChama_id(), borrowerUserId);

        User borrower = userRepository.findById(borrowerUserId)
                .orElseThrow(() -> new RuntimeException("Borrower user not found"));

        Chama chama = chamaRepository.findById(request.getChama_id())
                .orElseThrow(() -> new RuntimeException("Chama not found"));

        BigDecimal principal = request.getLoan_amount();
        BigDecimal rate = BigDecimal.valueOf(10.0); // 10% flat interest
        BigDecimal interest = principal.multiply(rate).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal totalRepayable = principal.add(interest);
        BigDecimal monthlyPayment = totalRepayable.divide(BigDecimal.valueOf(request.getTerm_months()), 2, RoundingMode.HALF_UP);

        Loan loan = Loan.builder()
                .chama(chama)
                .borrower(borrower)
                .loanAmount(principal)
                .termMonths(request.getTerm_months())
                .purpose(request.getPurpose())
                .interestRate(rate)
                .totalRepayable(totalRepayable)
                .monthlyPayment(monthlyPayment)
                .dueDate(LocalDate.now().plusMonths(1))
                .status("PENDING")
                .guarantorRequired(request.getGuarantor_required() != null ? request.getGuarantor_required() : false)
                .collateralDescription(request.getCollateral_description())
                .amountPaid(BigDecimal.ZERO)
                .build();

        Loan savedLoan = loanRepository.save(loan);

        if (request.getGuarantors() != null && !request.getGuarantors().isEmpty()) {
            for (LoanApplicationRequestDto.GuarantorPledgeDto pledge : request.getGuarantors()) {
                User guarantorUser = userRepository.findById(pledge.getUser_id())
                        .orElseThrow(() -> new RuntimeException("Guarantor user not found ID: " + pledge.getUser_id()));

                LoanGuarantor lg = LoanGuarantor.builder()
                        .loan(savedLoan)
                        .guarantorUser(guarantorUser)
                        .guaranteeAmount(pledge.getGuarantee_amount())
                        .status("PENDING")
                        .build();

                loanGuarantorRepository.save(lg);
            }
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

    @Transactional
    public void repayLoan(Long loanId, BigDecimal amount, Long payerUserId) {
        log.info("Payer ID {} repaying KES {} for loan ID: {}", payerUserId, amount, loanId);

        Loan loan = loanRepository.findByIdWithPessimisticLock(loanId)
                .orElseThrow(() -> new RuntimeException("Loan not found"));

        if (!"APPROVED".equalsIgnoreCase(loan.getStatus()) && !"ACTIVE".equalsIgnoreCase(loan.getStatus())) {
            throw new RuntimeException("Loan is not ACTIVE or APPROVED. Current status: " + loan.getStatus());
        }

        validateUserMembershipAndActiveStatus(loan.getChama().getChamaId(), payerUserId);

        BigDecimal currentPaid = loan.getAmountPaid() != null ? loan.getAmountPaid() : BigDecimal.ZERO;
        loan.setAmountPaid(currentPaid.add(amount));

        // Add back to chama fund
        Chama chama = chamaRepository.findByIdWithPessimisticLock(loan.getChama().getChamaId())
                .orElseThrow(() -> new RuntimeException("Chama not found"));
        chama.setCurrentFund(chama.getCurrentFund().add(amount));
        chamaRepository.save(chama);

        // Check if fully repaid
        if (loan.getAmountPaid().compareTo(loan.getTotalRepayable()) >= 0) {
            loan.setStatus("COMPLETED");
        }
        loanRepository.save(loan);

        // Write Financial Audit Log
        FinancialAuditLog auditLog = FinancialAuditLog.builder()
                .user(userRepository.getReferenceById(payerUserId))
                .transactionType("LOAN_REPAYMENT")
                .amount(amount)
                .chama(chama)
                .referenceId(loan.getLoanId())
                .description("Loan repayment recorded. Borrower ID: " + loan.getBorrower().getUserId() + ", Amount Paid: KES " + amount)
                .ipAddress("127.0.0.1")
                .userAgent("System-Service")
                .build();
        auditLogRepository.save(auditLog);
    }
}
