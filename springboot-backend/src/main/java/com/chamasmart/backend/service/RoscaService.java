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
public class RoscaService {

    private final RoscaCycleRepository roscaCycleRepository;
    private final RoscaRosterRepository roscaRosterRepository;
    private final ChamaRepository chamaRepository;
    private final ChamaMemberRepository chamaMemberRepository;

    @Transactional
    public RoscaCycleDto createCycle(RoscaCycleDto dto, Long chamaId) {
        log.info("Creating ROSCA cycle '{}' for chama ID: {}", dto.getCycle_name(), chamaId);
        Chama chama = chamaRepository.findById(chamaId)
                .orElseThrow(() -> new RuntimeException("Chama not found"));

        if (!"ROSCA".equalsIgnoreCase(chama.getChamaType())) {
            throw new RuntimeException("Chama is not configured as a ROSCA / Merry-Go-Round group");
        }

        List<ChamaMember> activeMembers = chamaMemberRepository.findByChamaChamaIdAndIsActiveTrue(chamaId);
        if (activeMembers.isEmpty()) {
            throw new RuntimeException("Cannot create a ROSCA cycle with zero active members");
        }

        RoscaCycle cycle = RoscaCycle.builder()
                .chama(chama)
                .cycleName(dto.getCycle_name())
                .startDate(dto.getStart_date() != null ? dto.getStart_date() : LocalDate.now())
                .endDate(dto.getEnd_date() != null ? dto.getEnd_date() : LocalDate.now().plusMonths(activeMembers.size()))
                .totalMembers(activeMembers.size())
                .contributionAmount(dto.getContribution_amount() != null ? dto.getContribution_amount() : chama.getContributionAmount())
                .payoutOrder(dto.getPayout_order() != null ? dto.getPayout_order() : "ROTATIONAL")
                .status("ACTIVE")
                .build();

        RoscaCycle savedCycle = roscaCycleRepository.save(cycle);

        // Assign initial roster positions sequentially
        int position = 1;
        for (ChamaMember member : activeMembers) {
            RoscaRoster roster = RoscaRoster.builder()
                    .cycle(savedCycle)
                    .user(member.getUser())
                    .position(position)
                    .status("ACTIVE")
                    .payoutDate(savedCycle.getStartDate().plusMonths(position - 1))
                    .build();

            roscaRosterRepository.save(roster);
            position++;
        }

        log.info("Successfully created ROSCA cycle ID: {} with {} roster positions", savedCycle.getCycleId(), activeMembers.size());
        List<RoscaRoster> rosterList = roscaRosterRepository.findByCycleCycleIdOrderByPositionAsc(savedCycle.getCycleId());
        return RoscaCycleDto.fromEntity(savedCycle, rosterList);
    }

    @Transactional(readOnly = true)
    public List<RoscaCycleDto> getCyclesByChamaId(Long chamaId) {
        log.info("Fetching ROSCA cycles for chama ID: {}", chamaId);
        List<RoscaCycle> cycles = roscaCycleRepository.findByChamaChamaId(chamaId);
        
        return cycles.stream().map(cycle -> {
            List<RoscaRoster> roster = roscaRosterRepository.findByCycleCycleIdOrderByPositionAsc(cycle.getCycleId());
            return RoscaCycleDto.fromEntity(cycle, roster);
        }).collect(Collectors.toList());
    }
}
