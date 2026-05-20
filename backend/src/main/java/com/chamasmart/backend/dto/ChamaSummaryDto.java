package com.chamasmart.backend.dto;

import com.chamasmart.backend.domain.Chama;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.time.ZonedDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChamaSummaryDto {
    @JsonProperty("chama_id")
    @JsonAlias({"chamaId", "chama_id"})
    private Long chama_id;

    @JsonProperty("chama_name")
    @JsonAlias({"chamaName", "chama_name"})
    private String chama_name;

    @JsonProperty("chama_type")
    @JsonAlias({"chamaType", "chama_type"})
    private String chama_type;

    private String description;

    @JsonProperty("contribution_amount")
    @JsonAlias({"contributionAmount", "contribution_amount"})
    private BigDecimal contribution_amount;

    @JsonProperty("contribution_frequency")
    @JsonAlias({"contributionFrequency", "contribution_frequency"})
    private String contribution_frequency;

    @JsonProperty("current_fund")
    @JsonAlias({"currentFund", "current_fund"})
    private BigDecimal current_fund;

    @JsonProperty("total_members")
    @JsonAlias({"totalMembers", "total_members"})
    private Integer total_members;

    private String visibility;

    @JsonProperty("is_active")
    @JsonAlias({"isActive", "is_active"})
    private Boolean is_active;

    @JsonProperty("created_at")
    @JsonAlias({"createdAt", "created_at"})
    private ZonedDateTime created_at;

    @JsonProperty("meeting_day")
    private String meeting_day;

    @JsonProperty("meeting_time")
    private LocalTime meeting_time;

    // Caller-specific role inside this Chama (CHAIRPERSON, TREASURER, SECRETARY, MEMBER).
    // Populated by the service layer — not stored on the Chama entity itself.
    private String role;

    @JsonProperty("custody_type")
    @JsonAlias({"custodyType", "custody_type"})
    private String custody_type;

    @JsonProperty("virtual_account_ref")
    @JsonAlias({"virtualAccountRef", "virtual_account_ref"})
    private String virtual_account_ref;

    @JsonProperty("payment_methods")
    @JsonAlias({"paymentMethods", "payment_methods"})
    private PaymentMethodDto payment_methods;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PaymentMethodDto {
        private String type;
        
        @JsonProperty("businessNumber")
        @JsonAlias({"businessNumber", "business_number"})
        private String businessNumber;

        @JsonProperty("accountNumber")
        @JsonAlias({"accountNumber", "account_ref", "account_number"})
        private String accountNumber;

        @JsonProperty("tillNumber")
        @JsonAlias({"tillNumber", "till_number"})
        private String tillNumber;

        @JsonProperty("phoneNumber")
        @JsonAlias({"phoneNumber", "phone_number"})
        private String phoneNumber;

        @JsonProperty("recipientName")
        @JsonAlias({"recipientName", "recipient_name"})
        private String recipientName;

        @JsonProperty("bankName")
        @JsonAlias({"bankName", "bank_name"})
        private String bankName;

        @JsonProperty("bankAccount")
        @JsonAlias({"bankAccount", "bank_account_number", "bankAccount"})
        private String bankAccount;

        @JsonProperty("bankAccountName")
        @JsonAlias({"bankAccountName", "bank_account_name"})
        private String bankAccountName;

        @JsonProperty("bankBranch")
        @JsonAlias({"bankBranch", "bank_branch"})
        private String bankBranch;
    }

    public static ChamaSummaryDto fromEntity(Chama chama) {
        return ChamaSummaryDto.builder()
                .chama_id(chama.getChamaId())
                .chama_name(chama.getChamaName())
                .chama_type(chama.getChamaType())
                .description(chama.getDescription())
                .contribution_amount(chama.getContributionAmount())
                .contribution_frequency(chama.getContributionFrequency())
                .current_fund(chama.getCurrentFund())
                .total_members(chama.getTotalMembers())
                .visibility(chama.getVisibility())
                .is_active(chama.getIsActive())
                .created_at(chama.getCreatedAt())
                .meeting_day(chama.getMeetingDay())
                .meeting_time(chama.getMeetingTime())
                .custody_type(chama.getCustodyType())
                .virtual_account_ref(chama.getVirtualAccountRef())
                .build();
    }

    public static ChamaSummaryDto fromEntity(Chama chama, com.chamasmart.backend.domain.ChamaPaymentConfig config) {
        ChamaSummaryDto dto = fromEntity(chama);
        if (config != null) {
            dto.setPayment_methods(PaymentMethodDto.builder()
                    .type(config.getPaymentType())
                    .businessNumber(config.getBusinessNumber())
                    .accountNumber(config.getAccountNumber())
                    .tillNumber(config.getPaymentType().equals("TILL") ? config.getBusinessNumber() : null)
                    .phoneNumber(config.getPhoneNumber())
                    .recipientName(config.getRecipientName())
                    .bankName(config.getBankName())
                    .bankAccount(config.getBankAccountNumber())
                    .bankAccountName(config.getBankAccountName())
                    .bankBranch(config.getBankBranch())
                    .build());
        }
        return dto;
    }
}
