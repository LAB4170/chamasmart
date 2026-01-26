/**
 * Unified Rate Limiting Module
 * Consolidates enhancedRateLimiting.js and rateLimitingV2.js
 *
 * Features:
 * - Single source of truth for rate limits
 * - Configurable limits
 * - Redis support with fallback to memory
 * - Detailed logging
 * - Easy to test and maintain
 */

const rateLimit = require("express-rate-limit");
const logger = require("../../utils/logger");

// Optional Redis support
let RedisStore = null;
let redisClient = null;

try {
  RedisStore = require("rate-limit-redis");
  const Redis = require("ioredis");

  redisClient = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  redisClient.on("error", (err) => {
    logger.warn("Redis rate limiting unavailable", { error: err.message });
    redisClient = null;
  });

  redisClient.on("connect", () => {
    logger.info("Redis rate limiting active");
  });
} catch (error) {
  logger.info("Rate limiting using in-memory store (Redis not available)");
}

/**
 * Create Redis store if available
 */
function createStore(prefix) {
  if (!redisClient || !RedisStore) {
    return undefined; // Use default in-memory store
  }

  try {
    // Handle different versions of rate-limit-redis
    if (typeof RedisStore === "function") {
      return new RedisStore({ client: redisClient, prefix });
    } else if (RedisStore.default) {
      return new RedisStore.default({ client: redisClient, prefix });
    }
    return RedisStore({ client: redisClient, prefix });
  } catch (error) {
    logger.warn("Failed to create Redis store, using memory", {
      error: error.message,
    });
    return undefined;
  }
}

/**
 * Rate limit configuration
 * All limits in one place for easy management
 */
const RATE_LIMITS = {
  // Authentication endpoints
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: "Too many login attempts. Please try again in 15 minutes.",
    skipSuccessfulRequests: false,
  },

  registration: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: "Too many registration attempts. Please try again in 1 hour.",
    skipSuccessfulRequests: false,
  },

  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: "Too many password reset attempts. Please try again in 1 hour.",
    skipSuccessfulRequests: false,
  },

  otpVerification: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message:
      "Too many OTP verification attempts. Please try again in 15 minutes.",
    skipSuccessfulRequests: false,
  },

  otpResend: {
    windowMs: 60 * 1000, // 1 minute
    max: 1,
    message: "Please wait 1 minute before requesting another OTP.",
    skipSuccessfulRequests: true,
  },

  // Financial operations
  financialTransaction: {
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 20,
    message:
      "Too many financial transactions. Please wait before trying again.",
    skipSuccessfulRequests: true,
  },

  loanApplication: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 5,
    message: "Too many loan applications. Maximum 5 per day.",
    skipSuccessfulRequests: false,
  },

  // General API
  apiGeneral: {
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: "Too many API requests. Please slow down.",
    skipSuccessfulRequests: true,
  },

  // Data export
  dataExport: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 5,
    message: "Too many data export requests. Maximum 5 per day.",
    skipSuccessfulRequests: false,
  },

  // Search
  search: {
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: "Too many search requests.",
    skipSuccessfulRequests: true,
  },
};

/**
 * Create rate limiter with config
 */
function createRateLimiter(name, customConfig = {}) {
  const config = RATE_LIMITS[name];

  if (!config) {
    throw new Error(`Unknown rate limit config: ${name}`);
  }

  const limiterConfig = {
    windowMs: config.windowMs,
    max: config.max,
    message: {
      success: false,
      message: config.message,
      retryAfter: Math.floor(config.windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: config.skipSuccessfulRequests,
    skip: (req) => {
      // Skip in test environment
      if (process.env.NODE_ENV === "test") {
        return true;
      }
      return false;
    },
    store: createStore(`rl:${name}:`),
    ...customConfig,
  };

  // Add custom handler for important endpoints
  if (["login", "registration", "passwordReset"].includes(name)) {
    limiterConfig.handler = (req, res) => {
      logger.warn(`Rate limit exceeded: ${name}`, {
        ip: req.ip,
        userId: req.user?.user_id,
        email: req.body?.email,
        endpoint: req.path,
      });

      res.status(429).json({
        success: false,
        message: config.message,
        retryAfter: Math.floor(config.windowMs / 1000),
      });
    };
  }

  return rateLimit(limiterConfig);
}

/**
 * Key generator functions
 */
const keyGenerators = {
  // For login - use email if available, otherwise IP
  login: (req) => {
    const email = req.body?.email || "";
    return `login:${email}:${req.ip}`;
  },

  // For authenticated endpoints - use user ID
  authenticated: (req) => {
    return `user:${req.user?.user_id || "anonymous"}:${req.ip}`;
  },

  // For IP-based limiting
  ip: (req) => {
    return req.ip;
  },
};

/**
 * Export individual limiters
 */
module.exports = {
  // Authentication
  loginLimiter: createRateLimiter("login", {
    keyGenerator: keyGenerators.login,
  }),

  registerLimiter: createRateLimiter("registration", {
    keyGenerator: keyGenerators.ip,
  }),

  passwordResetLimiter: createRateLimiter("passwordReset", {
    keyGenerator: keyGenerators.login,
  }),

  otpVerificationLimiter: createRateLimiter("otpVerification", {
    keyGenerator: keyGenerators.authenticated,
  }),

  otpResendLimiter: createRateLimiter("otpResend", {
    keyGenerator: keyGenerators.authenticated,
  }),

  // Financial
  financialTransactionLimiter: createRateLimiter("financialTransaction", {
    keyGenerator: keyGenerators.authenticated,
  }),

  loanApplicationLimiter: createRateLimiter("loanApplication", {
    keyGenerator: keyGenerators.authenticated,
  }),

  // General
  apiLimiter: createRateLimiter("apiGeneral", {
    keyGenerator: keyGenerators.authenticated,
  }),

  dataExportLimiter: createRateLimiter("dataExport", {
    keyGenerator: keyGenerators.authenticated,
  }),

  searchLimiter: createRateLimiter("search", {
    keyGenerator: keyGenerators.authenticated,
  }),

  // Utility functions
  createCustomLimiter: (config) => {
    return rateLimit({
      ...config,
      store: createStore("rl:custom:"),
      standardHeaders: true,
      legacyHeaders: false,
    });
  },

  // Get current config
  getConfig: (name) => {
    return RATE_LIMITS[name];
  },

  // Update config (for testing/admin)
  updateConfig: (name, updates) => {
    if (RATE_LIMITS[name]) {
      RATE_LIMITS[name] = { ...RATE_LIMITS[name], ...updates };
      logger.info(`Rate limit config updated: ${name}`, updates);
    }
  },

  // Health check
  healthCheck: async () => {
    return {
      redisAvailable: !!redisClient,
      redisConnected: redisClient?.status === "ready",
      configuredLimits: Object.keys(RATE_LIMITS),
      timestamp: new Date().toISOString(),
    };
  },
};
