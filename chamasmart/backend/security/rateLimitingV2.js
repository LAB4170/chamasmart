/**
 * Enhanced Rate Limiting - Zone-based protection
 * Zones: signup (5/1hr), login (5/15min), OTP (3/15min + 1/30sec resend)
 */

const rateLimit = require("express-rate-limit");
const RedisStore = require("rate-limit-redis");
const redis = require("../config/redis");
const logger = require("../utils/logger");

// ============================================================================
// RATE LIMITING ZONES
// ============================================================================

// Zone 1: Signup (5 attempts per hour per IP)
const signupLimiter = rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: "rate-limit:signup:",
    }),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 attempts per hour
    message: {
        success: false,
        message: "Too many signup attempts. Please try again after 1 hour.",
        retryAfter: 3600,
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip for development/testing
        return process.env.NODE_ENV === "test";
    },
    keyGenerator: (req) => {
        // Rate limit by IP address for signup
        return `signup:${req.ip}`;
    },
    handler: (req, res) => {
        logger.warn("🚨 Signup rate limit exceeded", {
            ip: req.ip,
            endpoint: req.path,
        });
        res.status(429).json({
            success: false,
            message: "Too many signup attempts. Please try again after 1 hour.",
            retryAfter: 3600,
        });
    },
});

// Zone 2: Login (5 attempts per 15 minutes per email + IP combination)
const loginLimiter = rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: "rate-limit:login:",
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: {
        success: false,
        message: "Too many login attempts. Please try again after 15 minutes.",
        retryAfter: 900,
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        return process.env.NODE_ENV === "test";
    },
    keyGenerator: (req) => {
        const email = req.body?.email || "";
        return `login:${email}:${req.ip}`;
    },
    handler: (req, res) => {
        logger.warn("🚨 Login rate limit exceeded", {
            email: req.body?.email || "unknown",
            ip: req.ip,
        });
        res.status(429).json({
            success: false,
            message: "Too many login attempts. Please try again after 15 minutes.",
            retryAfter: 900,
        });
    },
});

// Zone 3: OTP Verification (3 attempts per 15 minutes per contact)
const otpVerifyLimiter = rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: "rate-limit:otp-verify:",
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3,
    message: {
        success: false,
        message:
            "Too many OTP verification attempts. Please try again after 15 minutes.",
        retryAfter: 900,
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        return process.env.NODE_ENV === "test";
    },
    keyGenerator: (req) => {
        const contact =
            req.body?.signupToken || req.body?.phone || req.body?.email || "";
        return `otp-verify:${contact}:${req.ip}`;
    },
    handler: (req, res) => {
        logger.warn("🚨 OTP verification rate limit exceeded", {
            contact: req.body?.phone || req.body?.email || "unknown",
            ip: req.ip,
        });
        res.status(429).json({
            success: false,
            message:
                "Too many OTP attempts. Account temporarily locked. Try again after 15 minutes.",
            retryAfter: 900,
        });
    },
});

// Zone 4: OTP Resend (1 attempt per 30 seconds)
const otpResendLimiter = rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: "rate-limit:otp-resend:",
    }),
    windowMs: 30 * 1000, // 30 seconds
    max: 1,
    message: {
        success: false,
        message:
            "OTP resend rate limited. Wait at least 30 seconds before requesting again.",
        retryAfter: 30,
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        return process.env.NODE_ENV === "test";
    },
    keyGenerator: (req) => {
        const contact = req.body?.signupToken || "";
        return `otp-resend:${contact}:${req.ip}`;
    },
    handler: (req, res) => {
        logger.warn("⚠️ OTP resend rate limit - wait 30 seconds", {
            contact: req.body?.signupToken || "unknown",
        });
        res.status(429).json({
            success: false,
            message: "Please wait 30 seconds before requesting another OTP.",
            retryAfter: 30,
        });
    },
});

// Zone 5: API General (100 requests per minute per user)
const apiLimiter = rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: "rate-limit:api:",
    }),
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: {
        success: false,
        message: "API rate limit exceeded. Max 100 requests per minute.",
        retryAfter: 60,
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        return process.env.NODE_ENV === "test";
    },
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise use IP
        const userId = req.user?.userId || "anonymous";
        return `api:${userId}:${req.ip}`;
    },
    handler: (req, res) => {
        logger.warn("🚨 API rate limit exceeded", {
            userId: req.user?.userId || "anonymous",
            ip: req.ip,
        });
        res.status(429).json({
            success: false,
            message: "Rate limit exceeded. Maximum 100 requests per minute.",
            retryAfter: 60,
        });
    },
});

// ============================================================================
// RESET RATE LIMIT (Admin only - for testing/security)
// ============================================================================

const resetRateLimit = async (req, res) => {
    try {
        const { key } = req.params;

        if (!key) {
            return res.status(400).json({
                success: false,
                message: "Rate limit key is required",
            });
        }

        // Find and delete all matching keys
        const pattern = `rate-limit:*${key}*`;
        const keys = await redis.keys(pattern);

        if (keys.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No rate limit records found for this key",
            });
        }

        await redis.del(...keys);

        logger.info("✅ Rate limit reset", { key, keysDeleted: keys.length });

        res.json({
            success: true,
            message: `Rate limit reset for ${key}. Deleted ${keys.length} records.`,
        });
    } catch (error) {
        logger.error("Reset rate limit error", error);
        res.status(500).json({
            success: false,
            message: "Failed to reset rate limit",
        });
    }
};

// ============================================================================
// MIDDLEWARE CHAIN
// ============================================================================

const applyAuthRateLimiting = (req, res, next) => {
    const path = req.path;
    const method = req.method;

    // Route-based limiting
    if (method === "POST") {
        if (path.includes("/signup/start")) return signupLimiter(req, res, next);
        if (path.includes("/login")) return loginLimiter(req, res, next);
        if (path.includes("/signup/verify-otp"))
            return otpVerifyLimiter(req, res, next);
        if (path.includes("/signup/resend-otp"))
            return otpResendLimiter(req, res, next);
    }

    next();
};

module.exports = {
    signupLimiter,
    loginLimiter,
    otpVerifyLimiter,
    otpResendLimiter,
    apiLimiter,
    applyAuthRateLimiting,
    resetRateLimit,
};
