package com.chamasmart.backend.config;

import com.chamasmart.backend.util.FieldCrypto;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Component;

@Component("fieldCryptoConfig")
@Slf4j
public class FieldCryptoConfig {
    @Value("${app.security.data-key:}")
    private String dataKey;

    @PostConstruct
    void init() {
        if (!FieldCrypto.configure(dataKey)) {
            log.warn("DATA_ENCRYPTION_KEY is not set: national IDs are stored unencrypted. Generate one with `openssl rand -base64 32` and set it on the server.");
        }
    }
}
