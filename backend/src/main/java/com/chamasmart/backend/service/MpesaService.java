package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MpesaService {

    private final MpesaTransactionRepository mpesaTransactionRepository;
    private final ContributionRepository contributionRepository;
    private final ChamaRepository chamaRepository;
    private final UserRepository userRepository;
    private final ChamaMemberRepository chamaMemberRepository;
    private final FinancialAuditLogRepository auditLogRepository;

    @Transactional
    public MpesaTransaction initiateStkPush(MpesaStkPushRequestDto requestDto, Long userId) {
        log.info("Initiating M-Pesa STK Push for user ID: {}, chama ID: {}, amount: {}", userId, requestDto.getChamaId(), requestDto.getAmount());

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Chama chama = chamaRepository.findById(requestDto.getChamaId())
                .orElseThrow(() -> new RuntimeException("Chama not found"));

        // Mocking Safaricom Daraja STK Push CheckoutRequestID generation
        String checkoutRequestId = "ws_CO_" + UUID.randomUUID().toString().substring(0, 15).replace("-", "");
        String merchantRequestId = "req_" + UUID.randomUUID().toString().substring(0, 10).replace("-", "");

        MpesaTransaction transaction = MpesaTransaction.builder()
                .checkoutRequestId(checkoutRequestId)
                .merchantRequestId(merchantRequestId)
                .user(user)
                .chama(chama)
                .amount(requestDto.getAmount())
                .phoneNumber(requestDto.getPhoneNumber())
                .status("PENDING")
                .build();

        MpesaTransaction savedTransaction = mpesaTransactionRepository.save(transaction);
        log.info("M-Pesa STK Push initiated successfully. CheckoutRequestID: {}", checkoutRequestId);
        return savedTransaction;
    }

    @Transactional
    public void processCallback(MpesaCallbackDto callbackDto) {
        if (callbackDto.getBody() == null || callbackDto.getBody().getStkCallback() == null) {
            log.error("Invalid M-Pesa callback payload received");
            return;
        }

        MpesaCallbackDto.StkCallback stkCallback = callbackDto.getBody().getStkCallback();
        String checkoutRequestId = stkCallback.getCheckoutRequestID();
        Integer resultCode = stkCallback.getResultCode();
        String resultDesc = stkCallback.getResultDesc();

        log.info("Processing M-Pesa Callback for CheckoutRequestID: {}, ResultCode: {}", checkoutRequestId, resultCode);

        MpesaTransaction transaction = mpesaTransactionRepository.findByCheckoutRequestId(checkoutRequestId)
                .orElseThrow(() -> new RuntimeException("MpesaTransaction not found for CheckoutRequestID: " + checkoutRequestId));

        transaction.setResultCode(resultCode);
        transaction.setResultDesc(resultDesc);

        if (resultCode == 0) {
            // Transaction Successful
            transaction.setStatus("COMPLETED");

            // Extract MpesaReceiptNumber from metadata
            String mpesaReceipt = "MPESA" + System.currentTimeMillis();
            if (stkCallback.getCallbackMetadata() != null && stkCallback.getCallbackMetadata().getItem() != null) {
                for (MpesaCallbackDto.Item item : stkCallback.getCallbackMetadata().getItem()) {
                    if ("MpesaReceiptNumber".equalsIgnoreCase(item.getName()) && item.getValue() != null) {
                        mpesaReceipt = item.getValue().toString();
                        break;
                    }
                }
            }
            transaction.setMpesaReceipt(mpesaReceipt);

            // Create Contribution record
            Contribution contribution = Contribution.builder()
                    .chama(transaction.getChama())
                    .user(transaction.getUser())
                    .amount(transaction.getAmount())
                    .reference(mpesaReceipt)
                    .status("COMPLETED")
                    .contributionType("REGULAR")
                    .isDeleted(false)
                    .build();

            Contribution savedContribution = contributionRepository.save(contribution);
            transaction.setContribution(savedContribution);

            // Update ChamaMember total contributions
            chamaMemberRepository.findByChamaChamaIdAndUserUserId(transaction.getChama().getChamaId(), transaction.getUser().getUserId())
                    .ifPresent(member -> {
                        member.setTotalContributions(member.getTotalContributions().add(transaction.getAmount()));
                        member.setLastContributionDate(ZonedDateTime.now());
                        chamaMemberRepository.save(member);
                    });

            // Update Chama current fund
            Chama chama = transaction.getChama();
            chama.setCurrentFund(chama.getCurrentFund().add(transaction.getAmount()));
            chamaRepository.save(chama);

            // Write immutable Financial Audit Log
            FinancialAuditLog auditLog = FinancialAuditLog.builder()
                    .user(transaction.getUser())
                    .transactionType("MPESA_CONTRIBUTION")
                    .amount(transaction.getAmount())
                    .chama(transaction.getChama())
                    .referenceId(savedContribution.getContributionId())
                    .description("Successful M-Pesa STK Push contribution. Receipt: " + mpesaReceipt)
                    .ipAddress("127.0.0.1") // Callback IP
                    .userAgent("Safaricom-Daraja-Webhook")
                    .build();

            auditLogRepository.save(auditLog);
            log.info("Successfully processed M-Pesa contribution for Chama ID: {}, Amount: {}", chama.getChamaId(), transaction.getAmount());

        } else {
            // Transaction Failed / Cancelled by user
            transaction.setStatus("FAILED");
            log.warn("M-Pesa transaction failed. ResultDesc: {}", resultDesc);
        }

        mpesaTransactionRepository.save(transaction);
    }

    @Transactional(readOnly = true)
    public List<ContributionSummaryDto> getContributionsByChamaId(Long chamaId) {
        log.info("Fetching contributions for chama ID: {}", chamaId);
        return contributionRepository.findByChamaChamaIdAndIsDeletedFalse(chamaId).stream()
                .map(ContributionSummaryDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ContributionSummaryDto> getMyContributions(Long userId) {
        log.info("Fetching contributions for user ID: {}", userId);
        return contributionRepository.findByUserUserIdAndIsDeletedFalse(userId).stream()
                .map(ContributionSummaryDto::fromEntity)
                .collect(Collectors.toList());
    }
}
