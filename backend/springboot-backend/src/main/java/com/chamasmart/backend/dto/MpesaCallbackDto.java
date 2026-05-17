package com.chamasmart.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MpesaCallbackDto {

    @JsonProperty("Body")
    private Body body;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Body {
        @JsonProperty("stkCallback")
        private StkCallback stkCallback;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StkCallback {
        @JsonProperty("MerchantRequestID")
        private String merchantRequestID;

        @JsonProperty("CheckoutRequestID")
        private String checkoutRequestID;

        @JsonProperty("ResultCode")
        private Integer resultCode;

        @JsonProperty("ResultDesc")
        private String resultDesc;

        @JsonProperty("CallbackMetadata")
        private CallbackMetadata callbackMetadata;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CallbackMetadata {
        @JsonProperty("Item")
        private List<Item> item;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Item {
        @JsonProperty("Name")
        private String name;

        @JsonProperty("Value")
        private Object value;
    }
}
