package com.chamasmart.backend.config;

import com.cloudinary.Cloudinary;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CloudinaryConfig {

    @Value("${CLOUDINARY_URL:}")
    private String cloudinaryUrl;

    @Bean
    public Cloudinary cloudinary() {
        // Profile-picture upload is optional: without CLOUDINARY_URL the app still boots
        // and uploads are refused (see ProfilePictureService).
        if (cloudinaryUrl == null || cloudinaryUrl.isBlank()) {
            return new Cloudinary("cloudinary://unconfigured:unconfigured@unconfigured");
        }
        return new Cloudinary(cloudinaryUrl);
    }
}
