package com.chamasmart.backend.dto;

import com.chamasmart.backend.domain.AscaCycle;
import com.chamasmart.backend.domain.AscaMember;
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
public class AscaCycleDto {
    private Long cycle_id;
    private Long chama_id;
    private String cycle_name;
    private LocalDate start_date;
    private LocalDate end_date;
    private BigDecimal share_price;
    private Integer total_shares;
    private Integer available_shares;
    private BigDecimal dividend_rate;
    private String status;
    private ZonedDateTime created_at;
    private List<AscaMemberDto> members;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AscaMemberDto {
        private Long membership_id;
        private Long user_id;
        private String member_name;
        private Integer shares_owned;
        private BigDecimal total_investment;
        private BigDecimal dividends_earned;
        private String status;
    }

    public static AscaCycleDto fromEntity(AscaCycle cycle, List<AscaMember> memberList) {
        List<AscaMemberDto> memberDtos = memberList.stream()
                .map(m -> AscaMemberDto.builder()
                        .membership_id(m.getMembershipId())
                        .user_id(m.getUser().getUserId())
                        .member_name(m.getUser().getFirstName() + " " + m.getUser().getLastName())
                        .shares_owned(m.getSharesOwned())
                        .total_investment(m.getTotalInvestment())
                        .dividends_earned(m.getDividendsEarned())
                        .status(m.getStatus())
                        .build())
                .collect(Collectors.toList());

        return AscaCycleDto.builder()
                .cycle_id(cycle.getCycleId())
                .chama_id(cycle.getChama().getChamaId())
                .cycle_name(cycle.getCycleName())
                .start_date(cycle.getStartDate())
                .end_date(cycle.getEndDate())
                .share_price(cycle.getSharePrice())
                .total_shares(cycle.getTotalShares())
                .available_shares(cycle.getAvailableShares())
                .dividend_rate(cycle.getDividendRate())
                .status(cycle.getStatus())
                .created_at(cycle.getCreatedAt())
                .members(memberDtos)
                .build();
    }
}
