package com.chamasmart.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FirebaseSyncRequest {
    private String idToken;
    private String email;
    private String firstName;
    private String lastName;
    private String phoneNumber;
}
