package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.*;
import com.chamasmart.backend.dto.*;
import com.chamasmart.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AscaService {

    private final AscaCycleRepository ascaCycleRepository;
    private final AscaMemberRepository ascaMemberRepository;
    private final ChamaRepository chamaRepository;
    private final UserRepository userRepository;
    private final ChamaMemberRepository chamaMemberRepository;

    private ChamaMember validateUserMembershipAndActiveStatus(Long chamaId, Long userId) {
        return chamaMemberRepository.findByChamaChamaIdAndUserUserId(chamaId, userId)
                .filter(ChamaMember::getIsActive)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("Security Violation: User ID " + userId + " is not an active member of Chama ID " + chamaId));
    }

    private ChamaMember validateUserIsOfficial(Long chamaId, Long userId) {
        ChamaMember member = validateUserMembershipAndActiveStatus(chamaId, userId);
        if (!"CHAIRPERSON".equalsIgnoreCase(member.getRole()) && !"TREASURER".equalsIgnoreCase(member.getRole())) {
            throw new org.springframework.security.access.AccessDeniedException("Security Violation: User ID " + userId + " lacks official administrative privileges for Chama ID " + chamaId);
        }
        return member;
    }

    @Transactional
    public AscaCycleDto createCycle(AscaCycleDto dto, Long chamaId, Long userId) {
        log.info("Creating ASCA cycle '{}' for chama ID: {} by user ID: {}", dto.getCycle_name(), chamaId, userId);
        
        validateUserIsOfficial(chamaId, userId);
        Chama chama = chamaRepository.findById(chamaId)
                .orElseThrow(() -> new RuntimeException("Chama not found"));

        if (!"ASCA".equalsIgnoreCase(chama.getChamaType())) {
            throw new RuntimeException("Chama is not configured as an ASCA / Accumulating Savings group");
        }

        AscaCycle cycle = AscaCycle.builder()
                .chama(chama)
                .cycleName(dto.getCycle_name())
                .startDate(dto.getStart_date() != null ? dto.getStart_date() : LocalDate.now())
                .endDate(dto.getEnd_date() != null ? dto.getEnd_date() : LocalDate.now().plusYears(1))
                .sharePrice(dto.getShare_price() != null ? dto.getShare_price() : BigDecimal.valueOf(1000.0))
                .totalShares(dto.getTotal_shares() != null ? dto.getTotal_shares() : 1000)
                .availableShares(dto.getTotal_shares() != null ? dto.getTotal_shares() : 1000)
                .dividendRate(dto.getDividend_rate() != null ? dto.getDividend_rate() : BigDecimal.valueOf(5.0))
                .status("ACTIVE")
                .build();

        AscaCycle savedCycle = ascaCycleRepository.save(cycle);
        log.info("Successfully created ASCA cycle ID: {}", savedCycle.getCycleId());

        List<AscaMember> members = ascaMemberRepository.findByCycleCycleId(savedCycle.getCycleId());
        return AscaCycleDto.fromEntity(savedCycle, members);
    }

    @Transactional
    public AscaCycleDto purchaseShares(Long cycleId, Long userId, Integer sharesToPurchase) {
        log.info("Processing share purchase of {} shares by user ID: {} in cycle ID: {}", sharesToPurchase, userId, cycleId);
        AscaCycle cycle = ascaCycleRepository.findByIdWithPessimisticLock(cycleId)
                .orElseThrow(() -> new RuntimeException("ASCA cycle not found"));

        validateUserMembershipAndActiveStatus(cycle.getChama().getChamaId(), userId);

        if (!"ACTIVE".equals(cycle.getStatus())) {
            throw new RuntimeException("Cannot purchase shares in an inactive cycle");
        }

        if (cycle.getAvailableShares() < sharesToPurchase) {
            throw new RuntimeException("Not enough available shares in this cycle. Available: " + cycle.getAvailableShares());
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        BigDecimal investmentAmount = cycle.getSharePrice().multiply(BigDecimal.valueOf(sharesToPurchase));

        AscaMember member = ascaMemberRepository.findByCycleCycleIdAndUserUserId(cycleId, userId)
                .orElse(AscaMember.builder()
                        .cycle(cycle)
                        .user(user)
                        .sharesOwned(0)
                        .totalInvestment(BigDecimal.ZERO)
                        .dividendsEarned(BigDecimal.ZERO)
                        .status("ACTIVE")
                        .build());

        member.setSharesOwned(member.getSharesOwned() + sharesToPurchase);
        member.setTotalInvestment(member.getTotalInvestment().add(investmentAmount));
        ascaMemberRepository.save(member);

        cycle.setAvailableShares(cycle.getAvailableShares() - sharesToPurchase);
        AscaCycle updatedCycle = ascaCycleRepository.save(cycle);

        log.info("Successfully processed share purchase. Remaining available shares: {}", updatedCycle.getAvailableShares());
        List<AscaMember> members = ascaMemberRepository.findByCycleCycleId(updatedCycle.getCycleId());
        return AscaCycleDto.fromEntity(updatedCycle, members);
    }

    @Transactional(readOnly = true)
    public List<AscaCycleDto> getCyclesByChamaId(Long chamaId) {
        log.info("Fetching ASCA cycles for chama ID: {}", chamaId);
        List<AscaCycle> cycles = ascaCycleRepository.findByChamaChamaId(chamaId);

        return cycles.stream().map(cycle -> {
            List<AscaMember> members = ascaMemberRepository.findByCycleCycleId(cycle.getCycleId());
            return AscaCycleDto.fromEntity(cycle, members);
        }).collect(Collectors.toList());
    }
}
