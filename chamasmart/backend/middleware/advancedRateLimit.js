const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const logger = require('../utils/logger');

// Create Redis client for rate limiting
let redisClient;
try {
    redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
    });

    redisClient.on('error', (err) => {
        logger.error('Redis rate limit client error', { error: err.message });
    });
} catch (error) {
    logger.warn('Redis not available for rate limiting, using memory store');
    redisClient = null;
}

/**
 * Create rate limiter with Redis store (distributed) or memory store (single instance)
 */
function createRateLimiter(options = {}) {
    const config = {
        windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
        max: options.max || 100, // Limit each IP to 100 requests per windowMs
        message: options.message || 'Too many requests, please try again later.',
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                path: req.path,
                userId: req.user?.user_id,
            });

            res.status(429).json({
                success: false,
                message: options.message || 'Too many requests, please try again later.',
                retryAfter: Math.ceil(options.windowMs / 1000),
            });
        },
        skip: options.skip || (() => false),
        keyGenerator: options.keyGenerator || ((req) => req.ip),
    };

    // Use Redis store if available
    if (redisClient && !options.forceMemory) {
        config.store = new RedisStore({
            client: redisClient,
            prefix: options.prefix || 'rl:',
        });
    }

    return rateLimit(config);
}

/**
 * Predefined rate limiters for different endpoints
 */

// General API rate limit
const apiLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: 'Too many API requests, please try again later.',
    prefix: 'rl:api:',
});

// Strict rate limit for authentication endpoints
const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per 15 minutes
    message: 'Too many login attempts, please try again later.',
    prefix: 'rl:auth:',
    skipSuccessfulRequests: true, // Don't count successful logins
});

// Rate limit for registration
const registerLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registrations per hour per IP
    message: 'Too many accounts created, please try again later.',
    prefix: 'rl:register:',
});

// Rate limit for password reset
const passwordResetLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password reset requests per hour
    message: 'Too many password reset requests, please try again later.',
    prefix: 'rl:password:',
});

// Rate limit for creating resources (chamas, contributions, etc.)
const createResourceLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 creates per minute
    message: 'You are creating resources too quickly, please slow down.',
    prefix: 'rl:create:',
});

// Rate limit for file uploads
const uploadLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 uploads per hour
    message: 'Too many file uploads, please try again later.',
    prefix: 'rl:upload:',
});

// Per-user rate limiter (requires authentication)
const perUserLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute per user
    message: 'You are making requests too quickly, please slow down.',
    prefix: 'rl:user:',
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise fall back to IP
        return req.user?.user_id?.toString() || req.ip;
    },
});

// Expensive operation rate limiter (reports, exports, etc.)
const expensiveOperationLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 expensive operations per hour
    message: 'You have reached the limit for this operation, please try again later.',
    prefix: 'rl:expensive:',
    keyGenerator: (req) => {
        return req.user?.user_id?.toString() || req.ip;
    },
});

/**
 * Dynamic rate limiter based on user tier/plan
 */
function createTieredRateLimiter(options = {}) {
    return async (req, res, next) => {
        // Determine user tier
        const userTier = req.user?.tier || 'free';

        // Define limits per tier
        const tierLimits = {
            free: options.freeTier || 10,
            premium: options.premiumTier || 50,
            enterprise: options.enterpriseTier || 200,
        };

        const max = tierLimits[userTier] || tierLimits.free;

        // Create rate limiter with tier-specific limit
        const limiter = createRateLimiter({
            ...options,
            max,
            keyGenerator: (req) => {
                return `${userTier}:${req.user?.user_id || req.ip}`;
            },
        });

        return limiter(req, res, next);
    };
}

/**
 * Get rate limit info for a key
 */
async function getRateLimitInfo(key) {
    if (!redisClient) {
        return { available: false };
    }

    try {
        const data = await redisClient.get(`rl:${key}`);
        if (!data) {
            return { remaining: 'unlimited' };
        }

        const parsed = JSON.parse(data);
        return {
            limit: parsed.limit,
            remaining: parsed.limit - parsed.current,
            resetAt: new Date(parsed.resetTime),
        };
    } catch (error) {
        logger.error('Error getting rate limit info', { error: error.message, key });
        return { error: error.message };
    }
}

/**
 * Reset rate limit for a key (admin function)
 */
async function resetRateLimit(key) {
    if (!redisClient) {
        return { success: false, message: 'Redis not available' };
    }

    try {
        await redisClient.del(`rl:${key}`);
        logger.info('Rate limit reset', { key });
        return { success: true };
    } catch (error) {
        logger.error('Error resetting rate limit', { error: error.message, key });
        return { success: false, error: error.message };
    }
}

module.exports = {
    createRateLimiter,
    createTieredRateLimiter,
    getRateLimitInfo,
    resetRateLimit,
    // Predefined limiters
    apiLimiter,
    authLimiter,
    registerLimiter,
    passwordResetLimiter,
    createResourceLimiter,
    uploadLimiter,
    perUserLimiter,
    expensiveOperationLimiter,
};
