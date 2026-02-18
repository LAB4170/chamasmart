const crypto = require("crypto");
const path = require("path");
require("dotenv").config();

// ============================================================================
// ENVIRONMENT-SPECIFIC CONFIGURATION
// ============================================================================
// This provides additional layers of security for environment variables
// ============================================================================

class SecureConfig {
  constructor() {
    this.environment = process.env.NODE_ENV || "development";
    this.isProduction = this.environment === "production";
    this.isDevelopment = this.environment === "development";
    this.isTest = this.environment === "test";
  }

  // Get environment variable with validation
  get(key, required = true, defaultValue = null) {
    const value = process.env[key];

    if (required && !value) {
      throw new Error(`Required environment variable ${key} is missing`);
    }

    return value || defaultValue;
  }

  // Get database configuration with security
  getDatabaseConfig() {
    const config = {
      host: this.get("DB_HOST"),
      port: parseInt(this.get("DB_PORT")) || 5432,
      database: this.get("DB_NAME"),
      user: this.get("DB_USER"),
      password: this.get("DB_PASSWORD"),
      ssl: this.isProduction
        ? {
            rejectUnauthorized: false,
            // Additional SSL options for production
            minVersion: "TLSv1.2",
          }
        : false,
      // Connection pooling
      min: parseInt(this.get("DB_POOL_MIN")) || 2,
      max: parseInt(this.get("DB_POOL_MAX")) || 10,
      // Timeouts
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    };

    // Log configuration (without sensitive data)
    console.log("Database config loaded:", {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password ? "[REDACTED]" : null,
      ssl: !!config.ssl,
      environment: this.environment,
    });

    return config;
  }

  // Get JWT configuration
  getJWTConfig() {
    const secret = this.get("JWT_SECRET");

    // Enhanced JWT secret validation
    if (secret.length < 64) {
      throw new Error("JWT_SECRET must be at least 64 characters long");
    }

    // Check for sufficient entropy (at least 3 of: lowercase, uppercase, numbers, special chars)
    const hasLowercase = /[a-z]/.test(secret);
    const hasUppercase = /[A-Z]/.test(secret);
    const hasNumbers = /\d/.test(secret);
    const hasSpecial = /[^a-zA-Z0-9]/.test(secret);
    const complexityScore = [
      hasLowercase,
      hasUppercase,
      hasNumbers,
      hasSpecial,
    ].filter(Boolean).length;

    if (complexityScore < 3) {
      throw new Error(
        "JWT_SECRET must include at least 3 of: lowercase, uppercase, numbers, and special characters",
      );
    }

    // Check for common insecure patterns
    const commonPatterns = [
      "password",
      "secret",
      "jwt",
      "token",
      "chamasmart",
      "12345",
      "qwerty",
      "admin",
      "welcome",
      "letmein",
    ];

    const lowerSecret = secret.toLowerCase();
    if (commonPatterns.some((pattern) => lowerSecret.includes(pattern))) {
      throw new Error("JWT_SECRET contains common insecure patterns");
    }

    return {
      secret,
      refreshSecret: this.get("JWT_REFRESH_SECRET"),
      expiresIn: this.get("JWT_EXPIRE", false, "7d"),
      refreshExpiresIn: this.get("JWT_REFRESH_EXPIRE", false, "30d"),
      issuer: "chamasmart",
      audience: "chamasmart-users",
    };
  }

  // Get Redis configuration
  getRedisConfig() {
    return {
      host: this.get("REDIS_HOST", false, "localhost"),
      port: parseInt(this.get("REDIS_PORT", false, "6379")),
      password: this.get("REDIS_PASSWORD", false),
      db: parseInt(this.get("REDIS_DB", false, "0")),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };
  }

  // Get email configuration
  getEmailConfig() {
    const config = {
      host: this.get("EMAIL_HOST", false),
      port: parseInt(this.get("EMAIL_PORT", false, "587")),
      secure: this.get("EMAIL_SECURE", false, "false") === "true",
      user: this.get("EMAIL_USER", false),
      password: this.get("EMAIL_PASSWORD", false),
      from: this.get("EMAIL_FROM", false, "noreply@chamasmart.app"),
    };

    // Validate email config for production
    if (this.isProduction && (!config.user || !config.password)) {
      throw new Error("Email configuration is required in production");
    }

    return config;
  }

  // Get security configuration
  getSecurityConfig() {
    return {
      bcryptRounds: this.isProduction ? 12 : 10,
      maxLoginAttempts: parseInt(this.get("MAX_LOGIN_ATTEMPTS", false, "5")),
      lockoutDuration: parseInt(this.get("LOCKOUT_DURATION", false, "900000")), // 15 minutes
      sessionSecret: this.get(
        "SESSION_SECRET",
        false,
        crypto.randomBytes(32).toString("hex"),
      ),
      corsOrigin: this.get(
        "CORS_ORIGIN",
        false,
        this.isDevelopment ? "http://localhost:3000" : false,
      ),
      rateLimitWindowMs: parseInt(
        this.get("RATE_LIMIT_WINDOW_MS", false, "900000"),
      ), // 15 minutes
      rateLimitMax: parseInt(this.get("RATE_LIMIT_MAX", false, "100")),
    };
  }

  // Validate all required configurations
  validate() {
    const errors = [];

    try {
      this.getDatabaseConfig();
    } catch (error) {
      errors.push(`Database: ${error.message}`);
    }

    try {
      this.getJWTConfig();
    } catch (error) {
      errors.push(`JWT: ${error.message}`);
    }

    if (this.isProduction) {
      try {
        this.getEmailConfig();
      } catch (error) {
        errors.push(`Email: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join("\n")}`);
    }

    console.log(
      `✅ Configuration validated for ${this.environment} environment`,
    );
    return true;
  }

  // Get all configurations (for internal use)
  getAll() {
    return {
      environment: this.environment,
      database: this.getDatabaseConfig(),
      jwt: this.getJWTConfig(),
      redis: this.getRedisConfig(),
      email: this.getEmailConfig(),
      security: this.getSecurityConfig(),
    };
  }
}

// Create and export singleton instance
const config = new SecureConfig();

// Validate configuration on startup
if (process.env.NODE_ENV !== "test") {
  config.validate();
}

module.exports = config;
