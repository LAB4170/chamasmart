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
                .map(m -> new AscaMemberDto(
                        m.getMembershipId(),
                        m.getUser().getUserId(),
                        m.getUser().getFirstName() + " " + m.getUser().getLastName(),
                        m.getSharesOwned(),
                        m.getTotalInvestment(),
                        m.getDividendsEarned(),
                        m.getStatus()
                ))
                .collect(Collectors.toList());
        return new AscaCycleDto(
                cycle.getCycleId(),
                cycle.getChama().getChamaId(),
                cycle.getCycleName(),
                cycle.getStartDate(),
                cycle.getEndDate(),
                cycle.getSharePrice(),
                cycle.getTotalShares(),
                cycle.getAvailableShares(),
                cycle.getDividendRate(),
                cycle.getStatus(),
                cycle.getCreatedAt(),
                memberDtos
        );
    }
}

