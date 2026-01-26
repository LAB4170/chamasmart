/**
 * Unified Authentication Routes
 * Supports: Password, Email OTP, Phone OTP, Google OAuth, API Keys
 */

const express = require("express");
const router = express.Router();

// Controllers
const {
  // Password-based auth
  registerWithPassword,
  loginWithPassword,

  // OTP-based auth
  sendEmailOTP,
  sendPhoneOTP,
  verifyOTP,
  resendOTP,

  // OAuth
  googleAuth,
  googleCallback,

  // Token management
  refreshToken,
  logout,

  // Verification
  verifyEmail,
  verifyPhone,

  // Profile
  getMe,
} = require("../controllers/authController");

// Middleware
const { protect } = require("../middleware/auth");
const {
  apiKeyAuth,
  createAPIKey,
  listAPIKeys,
  revokeAPIKey,
  deleteAPIKey,
} = require("../middleware/apiKeyAuth");
const validate = require("../middleware/validate");
const { applyAuthRateLimiting } = require("../middleware/rateLimiting");

// Validation schemas
const {
  registerPasswordSchema,
  loginPasswordSchema,
  sendOTPSchema,
  verifyOTPSchema,
  googleAuthSchema,
} = require("../utils/validationSchemas");

// ============================================================================
// STRATEGY 1: PASSWORD-BASED AUTHENTICATION (Traditional)
// ============================================================================

router.post(
  "/register/password",
  applyAuthRateLimiting,
  validate(registerPasswordSchema),
  registerWithPassword,
);

router.post(
  "/login/password",
  applyAuthRateLimiting,
  validate(loginPasswordSchema),
  loginWithPassword,
);

// ============================================================================
// STRATEGY 2: OTP-BASED AUTHENTICATION (Passwordless)
// ============================================================================

// Step 1: Request OTP via email
router.post(
  "/login/email/send-otp",
  applyAuthRateLimiting,
  validate(sendOTPSchema),
  sendEmailOTP,
);

// Step 2: Request OTP via phone
router.post(
  "/login/phone/send-otp",
  applyAuthRateLimiting,
  validate(sendOTPSchema),
  sendPhoneOTP,
);

// Step 3: Verify OTP and login
router.post(
  "/login/verify-otp",
  applyAuthRateLimiting,
  validate(verifyOTPSchema),
  verifyOTP,
);

// Resend OTP
router.post(
  "/login/resend-otp",
  applyAuthRateLimiting,
  validate(sendOTPSchema),
  resendOTP,
);

// ============================================================================
// STRATEGY 3: OAUTH AUTHENTICATION (Social Login)
// ============================================================================

// Initiate Google OAuth
router.post(
  "/login/google",
  applyAuthRateLimiting,
  validate(googleAuthSchema),
  googleAuth,
);

// Google OAuth callback
router.get("/login/google/callback", googleCallback);

// Future: Add more OAuth providers
// router.post("/login/facebook", facebookAuth);
// router.post("/login/apple", appleAuth);

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

// Refresh access token using refresh token
router.post("/refresh-token", applyAuthRateLimiting, refreshToken);

// Logout (invalidate tokens)
router.post("/logout", protect, logout);

// ============================================================================
// VERIFICATION ENDPOINTS
// ============================================================================

// Verify email address
router.post("/verify/email", protect, applyAuthRateLimiting, verifyEmail);

// Verify phone number
router.post("/verify/phone", protect, applyAuthRateLimiting, verifyPhone);

// ============================================================================
// USER PROFILE
// ============================================================================

// Get current user info
router.get("/me", protect, getMe);

// ============================================================================
// API KEY MANAGEMENT (For programmatic access)
// ============================================================================

// Create new API key
router.post("/api-keys", protect, createAPIKey);

// List all API keys
router.get("/api-keys", protect, listAPIKeys);

// Revoke API key
router.patch("/api-keys/:keyId/revoke", protect, revokeAPIKey);

// Delete API key
router.delete("/api-keys/:keyId", protect, deleteAPIKey);

// ============================================================================
// FLEXIBLE AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Accepts both JWT and API Key authentication
 * Use this for routes that need to support both auth methods
 */
const flexibleAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer chama_")) {
    return apiKeyAuth(req, res, next);
  }

  return protect(req, res, next);
};

// Export for use in other routes
router.flexibleAuth = flexibleAuth;

module.exports = router;
