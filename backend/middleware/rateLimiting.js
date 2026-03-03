const { 
  loginLimiter, 
  apiLimiter, 
  registerLimiter 
} = require("../security/enhancedRateLimiting");

/**
 * Apply authentication-specific rate limiting
 * Re-purposed to use registerLimiter/loginLimiter logic
 */
const applyAuthRateLimiting = (req, res, next) => {
  if (process.env.NODE_ENV === "test") {
    return next();
  }
  // Use loginLimiter as the standard auth IP limiter
  return loginLimiter(req, res, next);
};

/**
 * General rate limiting for non-auth endpoints
 */
const applyRateLimiting = (req, res, next) => {
  if (process.env.NODE_ENV === "test") {
    return next();
  }
  return apiLimiter(req, res, next);
};

/**
 * Financial operations rate limiting (more strict)
 * Falls back to apiLimiter if specialized not defined, but keeping interface
 */
const applyFinancialRateLimiting = (req, res, next) => {
  if (process.env.NODE_ENV === "test") {
    return next();
  }
  // We can add a specialized financialLimiter to enhancedRateLimiting later if needed
  return apiLimiter(req, res, next);
};

module.exports = {
  applyAuthRateLimiting,
  applyRateLimiting,
  applyFinancialRateLimiting,
};
