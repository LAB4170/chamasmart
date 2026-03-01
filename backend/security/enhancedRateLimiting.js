/**
 * Enhanced Rate Limiting Configuration
 * CRITICAL SECURITY: Stricter limits for authentication endpoints
 */

const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { redis } = require("../config/redis");
const logger = require("../utils/logger");

const createRedisStore = (prefix) => {
  return new RedisStore({
    // @ts-ignore
    sendCommand: (...args) => redis.call(...args),
    prefix: prefix,
  });
};

/**
 * Helper functions for manual rate limit checks (used in server.js)
 */

exports.checkLoginRateLimit = async (identifier, ip) => {
  const key = `rl:login_check:${identifier}`;
  const ipKey = `rl:login_check:${ip}`;
  
  try {
    const [count, ipCount] = await Promise.all([
      redis.incr(key),
      redis.incr(ipKey)
    ]);

    if (count === 1) await redis.expire(key, 900); // 15 mins
    if (ipCount === 1) await redis.expire(ipKey, 900);

    return count > 5 || ipCount > 10;
  } catch (err) {
    logger.error("Login rate limit check error", { error: err.message });
    return false; // Fail open
  }
};

exports.checkOtpRateLimit = async (userId, ip) => {
  const key = `rl:otp_check:${userId || 'anon'}`;
  const ipKey = `rl:otp_check:${ip}`;

  try {
    const [count, ipCount] = await Promise.all([
      redis.incr(key),
      redis.incr(ipKey)
    ]);

    if (count === 1) await redis.expire(key, 900); // 15 mins
    if (ipCount === 1) await redis.expire(ipKey, 900);

    return count > 5 || ipCount > 10;
  } catch (err) {
    logger.error("OTP rate limit check error", { error: err.message });
    return false;
  }
};

exports.checkPasswordResetRateLimit = async (identifier, ip) => {
  const key = `rl:pwd_reset_check:${identifier}`;
  
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3600); // 1 hour
    return count > 3;
  } catch (err) {
    logger.error("Password reset rate limit check error", { error: err.message });
    return false;
  }
};

/**
 * Standard Middleware Limiters
 */

exports.loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts. Please try again in 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:login:"),
  handler: (req, res) => {
    logger.warn("LOGIN RATE LIMIT EXCEEDED", { ip: req.ip, email: req.body?.email });
    res.status(429).json({ success: false, message: "Too many login attempts. Try again in 15 minutes." });
  },
});

exports.registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: "Too many registration attempts.",
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:register:"),
});

exports.apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("rl:api:"),
  skip: (req) => {
    const path = req.path || "";
    return path === "/health" || path === "/api/ping" || path.startsWith("/metrics");
  },
});

module.exports = {
  ...exports,
  checkLoginRateLimit: exports.checkLoginRateLimit,
  checkOtpRateLimit: exports.checkOtpRateLimit,
  checkPasswordResetRateLimit: exports.checkPasswordResetRateLimit,
  loginLimiter: exports.loginLimiter,
  registerLimiter: exports.registerLimiter,
  apiLimiter: exports.apiLimiter,
};
