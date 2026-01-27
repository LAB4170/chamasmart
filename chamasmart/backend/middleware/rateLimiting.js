const rateLimit = require('express-rate-limit');
const { redis } = require('../config/redis');

/**
 * Apply authentication-specific rate limiting
 */
const applyAuthRateLimiting = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 auth requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: {
    async incr(key) {
      try {
        const result = await redis.incr(key);
        if (result === 1) {
          await redis.expire(key, 900); // 15 minutes
        }
        return result;
      } catch (error) {
        console.warn('Rate limiting error:', error.message);
        return 0; // Allow request if Redis fails
      }
    },
    async decr(key) {
      try {
        return await redis.decr(key);
      } catch (error) {
        console.warn('Rate limiting error:', error.message);
        return 0;
      }
    },
    async resetKey(key) {
      try {
        await redis.del(key);
      } catch (error) {
        console.warn('Rate limiting error:', error.message);
      }
    },
  },
});

/**
 * General rate limiting for non-auth endpoints
 */
const applyRateLimiting = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Financial operations rate limiting (more strict)
 */
const applyFinancialRateLimiting = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 financial requests per hour
  message: {
    success: false,
    message: 'Too many financial operations, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  applyAuthRateLimiting,
  applyRateLimiting,
  applyFinancialRateLimiting,
};
