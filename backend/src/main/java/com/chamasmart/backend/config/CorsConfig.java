package com.chamasmart.backend.config;

/**
 * CORS is configured in one place only: SecurityConfig.corsConfigurationSource().
 * The former global filter allowed every origin with credentials and has been removed.
 */
final class CorsConfig {
    private CorsConfig() { }
}
