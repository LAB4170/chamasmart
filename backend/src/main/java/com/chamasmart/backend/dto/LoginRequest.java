package com.chamasmart.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequest {
    private static final Logger log = LoggerFactory.getLogger(LoginRequest.class);
    private String email;
    private String password;
    public String getEmail() {
        return email;
    }

    public String getPassword() {
        return password;
    }
}



