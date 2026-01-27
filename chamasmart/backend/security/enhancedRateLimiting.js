const rateLimit = require('express-rate-limit');
const { redis } = require('../config/redis');

// Enhanced rate limiting configuration
const enhancedRateLimiting = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Special rate limit for authentication routes
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Redis-based rate limiting functions
const checkLoginRateLimit = async (identifier, ip) => {
  try {
    const key = `rate_limit:login:${identifier}`;
    const attempts = await redis.get(key);

    if (!attempts) {
      // First attempt, set counter
      await redis.setex(key, 900, '1'); // 15 minutes
      return false;
    }

    const count = parseInt(attempts);
    if (count >= 3) {
      return true; // Rate limited
    }

    // Increment counter
    await redis.incr(key);
    return false;
  } catch (error) {
    console.warn('Rate limiting error (login):', error.message);
    // Allow request if Redis fails
    return false;
  }
};

const checkOtpRateLimit = async (userId, ip) => {
  try {
    const key = `rate_limit:otp:${userId || ip}`;
    const attempts = await redis.get(key);

    if (!attempts) {
      await redis.setex(key, 900, '1'); // 15 minutes
      return false;
    }

    const count = parseInt(attempts);
    if (count >= 5) {
      return true; // Rate limited
    }

    await redis.incr(key);
    return false;
  } catch (error) {
    console.warn('Rate limiting error (OTP):', error.message);
    return false;
  }
};

const checkPasswordResetRateLimit = async (email, ip) => {
  try {
    const key = `rate_limit:reset:${email || ip}`;
    const attempts = await redis.get(key);

    if (!attempts) {
      await redis.setex(key, 3600, '1'); // 1 hour
      return false;
    }

    const count = parseInt(attempts);
    if (count >= 2) {
      return true; // Rate limited
    }

    await redis.incr(key);
    return false;
  } catch (error) {
    console.warn('Rate limiting error (password reset):', error.message);
    return false;
  }
};

module.exports = {
  enhancedRateLimiting,
  authRateLimit,
  checkLoginRateLimit,
  checkOtpRateLimit,
  checkPasswordResetRateLimit,
};
