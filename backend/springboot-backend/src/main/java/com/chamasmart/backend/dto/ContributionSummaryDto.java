package com.chamasmart.backend.dto;

import com.chamasmart.backend.domain.Contribution;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.ZonedDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContributionSummaryDto {
    private Long contribution_id;
    private Long chama_id;
    private String chama_name;
    private Long user_id;
    private String member_name;
    private BigDecimal amount;
    private String contribution_type;
    private String reference;
    private String status;
    private ZonedDateTime contribution_date;

    public static ContributionSummaryDto fromEntity(Contribution c) {
        return ContributionSummaryDto.builder()
                .contribution_id(c.getContributionId())
                .chama_id(c.getChama().getChamaId())
                .chama_name(c.getChama().getChamaName())
                .user_id(c.getUser().getUserId())
                .member_name(c.getUser().getFirstName() + " " + c.getUser().getLastName())
                .amount(c.getAmount())
                .contribution_type(c.getContributionType())
                .reference(c.getReference())
                .status(c.getStatus())
                .contribution_date(c.getContributionDate())
                .build();
    }
}
