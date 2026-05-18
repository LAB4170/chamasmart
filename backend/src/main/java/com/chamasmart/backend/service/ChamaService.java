package com.chamasmart.backend.service;

import com.chamasmart.backend.domain.Chama;
import com.chamasmart.backend.domain.ChamaMember;
import com.chamasmart.backend.domain.User;
import com.chamasmart.backend.dto.ChamaSummaryDto;
import com.chamasmart.backend.repository.ChamaMemberRepository;
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

    @Transactional(readOnly = true)
    public List<ChamaSummaryDto> getMyChamas(Long userId) {
        log.info("Fetching active chamas for user ID: {}", userId);
        List<ChamaMember> memberships = chamaMemberRepository.findActiveMembershipsByUserId(userId);
        
        return memberships.stream()
                .map(member -> ChamaSummaryDto.fromEntity(member.getChama()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ChamaSummaryDto getChamaById(Long chamaId) {
        Chama chama = chamaRepository.findById(chamaId)
                .orElseThrow(() -> new RuntimeException("Chama not found with ID: " + chamaId));
        return ChamaSummaryDto.fromEntity(chama);
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
                .build();

        Chama savedChama = chamaRepository.save(chama);

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

        return ChamaSummaryDto.fromEntity(savedChama);
    }
}
