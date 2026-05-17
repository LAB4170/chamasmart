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

    private ChamaMember validateUserMembershipAndActiveStatus(Long chamaId, Long userId) {
        return chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, userId)
                .filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("Security Violation: User ID " + userId + " is not an active member of Chama ID " + chamaId));
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
}
