/**
 * Enhanced Rate Limiting Configuration
 * CRITICAL SECURITY: Stricter limits for authentication endpoints
 */

const rateLimit = require("express-rate-limit");
const RedisStore = require("rate-limit-redis");
const Redis = require("ioredis");
const logger = require("../utils/logger");

// Helper to support different versions/exports of rate-limit-redis
const createRedisStore = (opts) => {
  if (!RedisStore) return undefined;
  try {
    // Some versions export a constructor
    // eslint-disable-next-line new-cap
    return new RedisStore(opts);
  } catch (err) {
    try {
      // Other versions export a factory function
      return RedisStore(opts);
    } catch (err2) {
      logger.warn(
        "Unable to create RedisStore for rate limiting",
        err2.message || err2,
      );
      return undefined;
    }
  }
};

let redisClient;
try {
  redisClient = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });

  redisClient.on("error", (err) => {
    logger.error("Redis rate limit error:", err.message);
  });
} catch (error) {
  logger.warn("Redis not available for enhanced rate limiting");
  redisClient = null;
}

/**
 * PHASE 1 CRITICAL: Enhanced Rate Limiters
 * These are MUCH stricter than before
 */

// ============================================================================
// AUTHENTICATION ENDPOINTS - CRITICAL SECURITY
// ============================================================================

// Login attempts: 5 per 15 minutes (DOWN from 100!)
exports.loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // CRITICAL: Only 5 attempts
  message: "Too many login attempts. Please try again in 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => false,
  keyGenerator: (req) => req.ip,
  store: redisClient
    ? createRedisStore({
      client: redisClient,
      prefix: "rl:login:",
    })
    : undefined,
  handler: (req, res) => {
    logger.warn("LOGIN RATE LIMIT EXCEEDED", {
      ip: req.ip,
      email: req.body?.email,
      attempts: req.rateLimit.current,
    });

    res.status(429).json({
      success: false,
      message:
        "Too many login attempts. Your account is temporarily locked. Try again in 15 minutes.",
      retryAfter: 900,
    });
  },
});

// Registration: 3 new accounts per hour per IP (DOWN from loose limit)
exports.registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: "Too many registration attempts. Please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  store: redisClient
    ? createRedisStore({
      client: redisClient,
      prefix: "rl:register:",
    })
    : undefined,
  handler: (req, res) => {
    logger.warn("REGISTRATION RATE LIMIT EXCEEDED", {
      ip: req.ip,
      email: req.body?.email,
    });

    res.status(429).json({
      success: false,
      message:
        "Too many registrations from this IP. Please try again in 1 hour.",
      retryAfter: 3600,
    });
  },
});

// Password reset: 3 attempts per hour
exports.passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: "Too many password reset attempts.",
  standardHeaders: true,
  legacyHeaders: false,
  store: redisClient
    ? createRedisStore({
      client: redisClient,
      prefix: "rl:password:",
    })
    : undefined,
  handler: (req, res) => {
    logger.warn("PASSWORD RESET RATE LIMIT EXCEEDED", {
      ip: req.ip,
      email: req.body?.email,
    });

    res.status(429).json({
      success: false,
      message: "Too many password reset requests. Please try again in 1 hour.",
      retryAfter: 3600,
    });
  },
});

// OTP verification: 5 attempts per 15 minutes
exports.otpVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many OTP verification attempts.",
  standardHeaders: true,
  legacyHeaders: false,
  store: redisClient
    ? createRedisStore({
      client: redisClient,
      prefix: "rl:otp:",
    })
    : undefined,
});

// ============================================================================
// SENSITIVE OPERATIONS - HIGH SECURITY
// ============================================================================

// Create/update resources: 50 per 5 minutes per user
exports.createResourceLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 50,
  message: "Too many resource creation requests.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.user_id || req.ip,
  store: redisClient
    ? createRedisStore({
      client: redisClient,
      prefix: "rl:create:",
    })
    : undefined,
});

// Financial transactions: 20 per 10 minutes per user
exports.financialTransactionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: "Too many financial transactions. Please wait before trying again.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.user_id || req.ip,
  store: redisClient
    ? createRedisStore({
      client: redisClient,
      prefix: "rl:finance:",
    })
    : undefined,
  handler: (req, res) => {
    logger.warn("FINANCIAL RATE LIMIT EXCEEDED", {
      userId: req.user?.user_id,
      ip: req.ip,
      endpoint: req.path,
    });

    res.status(429).json({
      success: false,
      message:
        "Too many financial transactions. Please wait before trying again.",
      retryAfter: 600,
    });
  },
});

// Loan applications: 5 per 24 hours per user
exports.loanApplicationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  message: "Too many loan applications. Maximum 5 per day.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.user_id || req.ip,
  store: redisClient
    ? createRedisStore({
      client: redisClient,
      prefix: "rl:loans:",
    })
    : undefined,
});

// ============================================================================
// GENERAL API ENDPOINTS
// ============================================================================

// General API rate limit: 100 per 15 minutes per IP
exports.apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const path = req.path || "";
    // Skip rate limiting for health checks
    return (
      path === "/health" || path === "/api/ping" || path.startsWith("/metrics")
    );
  },
  store: redisClient
    ? createRedisStore({
      client: redisClient,
      prefix: "rl:api:",
    })
    : undefined,
});

// List endpoints: 50 per minute
exports.listLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: "Too many list requests.",
  standardHeaders: true,
  legacyHeaders: false,
  store: redisClient
    ? createRedisStore({
      client: redisClient,
      prefix: "rl:list:",
    })
    : undefined,
});

// ============================================================================
// EXPORT/DOWNLOAD ENDPOINTS
// ============================================================================

// Data export: 5 per day per user
exports.dataExportLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  message: "Too many data exports. Maximum 5 per day.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.user_id || req.ip,
  store: redisClient
    ? createRedisStore({
      client: redisClient,
      prefix: "rl:export:",
    })
    : undefined,
});

// Report generation: 10 per hour
exports.reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many report generation requests.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.user_id || req.ip,
  store: redisClient
    ? createRedisStore({
      client: redisClient,
      prefix: "rl:report:",
    })
    : undefined,
});

// ============================================================================
// SEARCH AND FILTER ENDPOINTS (Prevent abuse)
// ============================================================================

// Search: 30 per minute
exports.searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many search requests.",
  standardHeaders: true,
  legacyHeaders: false,
  store: redisClient
    ? createRedisStore({
      client: redisClient,
      prefix: "rl:search:",
    })
    : undefined,
});

// ============================================================================
// UTILITY FUNCTION: Create dynamic rate limiter
// ============================================================================

exports.createDynamicLimiter = (windowMs, max, prefix) => {
  return rateLimit({
    windowMs,
    max,
    message: "Too many requests.",
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient
      ? new RedisStore({
        client: redisClient,
        prefix: prefix || "rl:dynamic:",
      })
      : undefined,
  });
};

// ============================================================================
// MONITORING: Log rate limit usage
// ============================================================================

exports.logRateLimitStatus = async () => {
  if (!redisClient) return;

  try {
    const keys = await redisClient.keys("rl:*");
    logger.info("Rate limit status", {
      limitedKeys: keys.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to log rate limit status:", error.message);
  }
};

module.exports;
