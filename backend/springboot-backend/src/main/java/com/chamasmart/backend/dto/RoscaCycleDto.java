package com.chamasmart.backend.dto;

import com.chamasmart.backend.domain.RoscaCycle;
import com.chamasmart.backend.domain.RoscaRoster;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoscaCycleDto {
    private Long cycle_id;
    private Long chama_id;
    private String cycle_name;
    private LocalDate start_date;
    private LocalDate end_date;
    private Integer total_members;
    private BigDecimal contribution_amount;
    private String payout_order;
    private String status;
    private ZonedDateTime created_at;
    private List<RosterPositionDto> roster;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RosterPositionDto {
        private Long roster_id;
        private Long user_id;
        private String member_name;
        private Integer position;
        private String status;
        private LocalDate payout_date;
    }

    public static RoscaCycleDto fromEntity(RoscaCycle cycle, List<RoscaRoster> rosterList) {
        List<RosterPositionDto> rosterDtos = rosterList.stream()
                .map(r -> RosterPositionDto.builder()
                        .roster_id(r.getRosterId())
                        .user_id(r.getUser().getUserId())
                        .member_name(r.getUser().getFirstName() + " " + r.getUser().getLastName())
                        .position(r.getPosition())
                        .status(r.getStatus())
                        .payout_date(r.getPayoutDate())
                        .build())
                .collect(Collectors.toList());

        return RoscaCycleDto.builder()
                .cycle_id(cycle.getCycleId())
                .chama_id(cycle.getChama().getChamaId())
                .cycle_name(cycle.getCycleName())
                .start_date(cycle.getStartDate())
                .end_date(cycle.getEndDate())
                .total_members(cycle.getTotalMembers())
                .contribution_amount(cycle.getContributionAmount())
                .payout_order(cycle.getPayoutOrder())
                .status(cycle.getStatus())
                .created_at(cycle.getCreatedAt())
                .roster(rosterDtos)
                .build();
    }
}
