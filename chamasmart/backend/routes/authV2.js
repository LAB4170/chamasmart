/**
 * Auth Routes v2 - Multi-option authentication
 * Signup: Email OTP, Phone OTP, Google OAuth, Passwordless
 */

const express = require("express");
const router = express.Router();

const authControllerV2 = require("../controllers/authControllerV2");
const { applyAuthRateLimiting } = require("../security/rateLimitingV2");
const {
  apiKeyAuth,
  createAPIKey,
  listAPIKeys,
  revokeAPIKey,
  deleteAPIKey,
} = require("../middleware/apiKeyAuth");
const { protect } = require("../middleware/auth");

// ============================================================================
// PUBLIC SIGNUP ROUTES (with rate limiting)
// ============================================================================

// Step 1: Initiate signup with email, phone, or Google
router.post(
  "/signup/start",
  applyAuthRateLimiting,
  authControllerV2.signupStart,
);

// Step 2: Verify OTP and create account
router.post(
  "/signup/verify-otp",
  applyAuthRateLimiting,
  authControllerV2.signupVerifyOTP,
);

// Step 3: Google OAuth callback
router.post("/signup/google", authControllerV2.signupGoogle);

// Resend OTP
router.post(
  "/signup/resend-otp",
  applyAuthRateLimiting,
  authControllerV2.resendOTP,
);

// ============================================================================
// TOKEN REFRESH
// ============================================================================

router.post("/refresh-token", authControllerV2.refreshAccessToken);

// ============================================================================
// API KEY MANAGEMENT (Authenticated)
// ============================================================================

// Create new API key
router.post("/api-keys", protect, createAPIKey);

// List all API keys for authenticated user
router.get("/api-keys", protect, listAPIKeys);

// Revoke API key
router.delete("/api-keys/:keyId/revoke", protect, revokeAPIKey);

// Delete API key
router.delete("/api-keys/:keyId", protect, deleteAPIKey);

// ============================================================================
// PROTECTED ROUTES (using API key or JWT)
// ============================================================================

// Middleware to accept either JWT or API key
const flexibleAuth = (req, res, next) => {
  // Check if API key is provided
  if (req.headers.authorization?.startsWith("Bearer chama_")) {
    return apiKeyAuth(req, res, next);
  }
  // Otherwise use JWT auth
  return authMiddleware(req, res, next);
};

// Example protected endpoint
router.get("/profile", flexibleAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      userId: req.user.userId,
      email: req.user.email,
      authenticatedVia: req.user.authenticatedVia || "jwt",
    },
  });
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Auth service is operational",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
