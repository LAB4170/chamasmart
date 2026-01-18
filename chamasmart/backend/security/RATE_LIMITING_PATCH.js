/**
 * FAST-TRACK INTEGRATION: Rate Limiting Middleware Patch
 * File: backend/server.js - ADD THIS SECTION
 *
 * Location: BEFORE the routes section (around line 80)
 * Add this after cacheControlMiddleware setup
 */

// ============================================================================
// CRITICAL: Rate Limiting Middleware for Authentication
// ============================================================================

// Import enhanced rate limiting
const {
  checkLoginRateLimit,
  checkOtpRateLimit,
  checkPasswordResetRateLimit,
} = require("./security/enhancedRateLimiting");

// Rate limit: Login attempts (3 per 15 minutes per email)
app.use("/api/auth/login", async (req, res, next) => {
  try {
    // Use email if provided, otherwise IP
    const identifier = req.body.email || req.ip;
    const isLimited = await checkLoginRateLimit(identifier, req.ip);

    if (isLimited) {
      return res.status(429).json({
        success: false,
        message: "Too many login attempts. Please try again in 15 minutes.",
      });
    }
    next();
  } catch (err) {
    logger.error("Rate limit check failed", {
      context: "rate_limit_login",
      error: err.message,
    });
    next(); // Continue on error to avoid breaking auth
  }
});

// Rate limit: OTP verification (5 per 15 minutes)
app.use("/api/auth/verify-phone", async (req, res, next) => {
  try {
    const isLimited = await checkOtpRateLimit(req.user.user_id, req.ip);

    if (isLimited) {
      return res.status(429).json({
        success: false,
        message: "Too many OTP attempts. Please try again later.",
      });
    }
    next();
  } catch (err) {
    logger.error("Rate limit check failed", {
      context: "rate_limit_otp",
      error: err.message,
    });
    next();
  }
});

// Rate limit: Password reset (2 per hour)
app.use("/api/auth/password-reset", async (req, res, next) => {
  try {
    const identifier = req.body.email || req.ip;
    const isLimited = await checkPasswordResetRateLimit(identifier, req.ip);

    if (isLimited) {
      return res.status(429).json({
        success: false,
        message: "Too many password reset requests. Please try again later.",
      });
    }
    next();
  } catch (err) {
    logger.error("Rate limit check failed", {
      context: "rate_limit_password",
      error: err.message,
    });
    next();
  }
});

logger.info("Rate limiting middleware activated", {
  context: "server_init",
  limits: {
    login: "3 per 15 minutes",
    otp: "5 per 15 minutes",
    passwordReset: "2 per hour",
  },
});

// ============================================================================
// End Rate Limiting Section
// ============================================================================
