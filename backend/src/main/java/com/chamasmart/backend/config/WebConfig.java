package com.chamasmart.backend.config;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
@Configuration
public class WebConfig implements WebMvcConfigurer {
    // Serve uploaded avatars and other static files
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Map /uploads/** to the filesystem uploads directory (relative to working dir)
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:./uploads/");
    }
    // Optional: allow CORS for local dev (if needed)
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}

