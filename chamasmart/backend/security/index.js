/**
 * Security Module Entry Point
 * Central export for all security-related functionality
 */

const SecurityManager = require("./security-manager");

// Initialize the security manager with configuration
const security = new SecurityManager({
  // Enable strict mode (fail fast on security issues)
  strictMode: process.env.NODE_ENV === "production",

  // Rate limiting configuration
  rateLimiting: {
    redis: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      enableOfflineQueue: false,
    },
    // Default rate limits can be overridden
    defaultLimits: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    },
  },

  // Audit logging configuration
  auditLogging: {
    enableBatching: true,
    batchSize: 100,
    strictMode: process.env.AUDIT_STRICT_MODE === "true",
    // Retention period in days
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS) || 730, // 2 years
  },

  // Encryption configuration
  encryption: {
    key: process.env.ENCRYPTION_KEY,
    algorithm: "aes-256-gcm",
    ivLength: 16,
    saltLength: 32,
  },
});

// Initialize security components
security.initialize().catch((err) => {
  console.error("Failed to initialize security module:", err);
  if (process.env.NODE_ENV === "production") {
    process.exit(1); // Exit in production if security can't be initialized
  }
});

// Export security manager instance and utilities
module.exports = {
  // Core security manager
  security,

  // Individual modules (for advanced usage)
  modules: {
    encryption: security.encryption,
    rateLimiting: security.rateLimiting,
    auditLogger: security.auditLogger,
    keyManager: security.keyManager,
  },

  // Helper functions
  middleware: {
    rateLimit: security.rateLimiting.middleware,
    authenticate: security.authenticate,
    authorize: security.authorize,
  },

  // Types and constants
  constants: {
    ROLES: {
      ADMIN: "admin",
      MEMBER: "member",
      GUEST: "guest",
    },
    PERMISSIONS: {
      READ: "read",
      WRITE: "write",
      DELETE: "delete",
      MANAGE: "manage",
    },
  },
};
