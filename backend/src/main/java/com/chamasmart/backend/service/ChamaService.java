package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.Chama;
import com.chamasmart.backend.domain.ChamaMember;
import com.chamasmart.backend.domain.ChamaPaymentConfig;
import com.chamasmart.backend.domain.User;
import com.chamasmart.backend.dto.ChamaSummaryDto;
import com.chamasmart.backend.repository.ChamaMemberRepository;
import com.chamasmart.backend.repository.ChamaPaymentConfigRepository;
import com.chamasmart.backend.repository.ChamaRepository;
import com.chamasmart.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChamaService {

    private final ChamaRepository chamaRepository;
    private final ChamaMemberRepository chamaMemberRepository;
    private final UserRepository userRepository;
    private final ChamaPaymentConfigRepository chamaPaymentConfigRepository;

    @Transactional(readOnly = true)
    public List<ChamaSummaryDto> getMyChamas(Long userId) {
        log.info("Fetching active chamas for user ID: {}", userId);
        List<ChamaMember> memberships = chamaMemberRepository.findActiveMembershipsByUserId(userId);

        return memberships.stream()
                .map(member -> {
                    Chama chama = member.getChama();
                    ChamaPaymentConfig config = chamaPaymentConfigRepository.findByChamaChamaId(chama.getChamaId()).orElse(null);
                    ChamaSummaryDto dto = ChamaSummaryDto.fromEntity(chama, config);
                    dto.setRole(member.getRole()); // include caller's chama-specific role
                    return dto;
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ChamaSummaryDto getChamaById(Long chamaId) {
        Chama chama = chamaRepository.findById(chamaId)
                .orElseThrow(() -> new RuntimeException("Chama not found with ID: " + chamaId));
        ChamaPaymentConfig config = chamaPaymentConfigRepository.findByChamaChamaId(chamaId).orElse(null);
        return ChamaSummaryDto.fromEntity(chama, config);
    }

    @Transactional
    public ChamaSummaryDto createChama(ChamaSummaryDto dto, Long creatorUserId) {
        log.info("Creating new chama '{}' by user ID: {}", dto.getChama_name(), creatorUserId);
        User creator = userRepository.findById(creatorUserId)
                .orElseThrow(() -> new RuntimeException("Creator user not found"));

        Chama chama = Chama.builder()
                .chamaName(dto.getChama_name())
                .chamaType(dto.getChama_type())
                .description(dto.getDescription())
                .contributionAmount(dto.getContribution_amount() != null ? dto.getContribution_amount() : BigDecimal.ZERO)
                .contributionFrequency(dto.getContribution_frequency() != null ? dto.getContribution_frequency() : "MONTHLY")
                .visibility(dto.getVisibility() != null ? dto.getVisibility() : "PRIVATE")
                .meetingDay(dto.getMeeting_day())
                .meetingTime(dto.getMeeting_time())
                .totalMembers(1) // Creator is first member
                .currentFund(BigDecimal.ZERO)
                .isActive(true)
                .createdBy(creator)
                .custodyType(dto.getCustody_type() != null ? dto.getCustody_type() : "MANAGED")
                .build();

        Chama savedChama = chamaRepository.save(chama);

        // Assign a virtual account reference automatically
        savedChama.setVirtualAccountRef("CS-" + (1000 + savedChama.getChamaId()));
        savedChama = chamaRepository.save(savedChama);

        // Save self-managed configuration if requested
        ChamaPaymentConfig config = null;
        if ("SELF_MANAGED".equals(savedChama.getCustodyType()) && dto.getPayment_methods() != null) {
            ChamaSummaryDto.PaymentMethodDto pm = dto.getPayment_methods();
            config = ChamaPaymentConfig.builder()
                    .chama(savedChama)
                    .paymentType(pm.getType() != null ? pm.getType() : "PAYBILL")
                    .businessNumber(pm.getBusinessNumber() != null ? pm.getBusinessNumber() : pm.getTillNumber())
                    .accountNumber(pm.getAccountNumber())
                    .phoneNumber(pm.getPhoneNumber())
                    .recipientName(pm.getRecipientName())
                    .bankName(pm.getBankName())
                    .bankAccountNumber(pm.getBankAccount())
                    .bankAccountName(pm.getBankAccountName())
                    .bankBranch(pm.getBankBranch())
                    .build();
            config = chamaPaymentConfigRepository.save(config);
        }

        ChamaMember chairperson = ChamaMember.builder()
                .chama(savedChama)
                .user(creator)
                .role("CHAIRPERSON")
                .status("ACTIVE")
                .totalContributions(BigDecimal.ZERO)
                .isActive(true)
                .build();

        chamaMemberRepository.save(chairperson);
        log.info("Successfully created chama with ID: {}", savedChama.getChamaId());

        ChamaSummaryDto result = ChamaSummaryDto.fromEntity(savedChama, config);
        result.setRole("CHAIRPERSON"); // creator is always the chairperson
        return result;
    }
}
