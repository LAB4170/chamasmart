/**
 * Unified Authentication Routes
 * Supports: Password, Email OTP, Phone OTP, Google OAuth, API Keys
 */

const express = require('express');

const router = express.Router();

// Controllers
const {
  register,
  login,
  verifyEmail,
  verifyPhone,
  firebaseSync,
} = require('../controllers/authController');

// Middleware
const { protect } = require('../middleware/auth');
const {
  apiKeyAuth,
  createAPIKey,
  listAPIKeys,
  revokeAPIKey,
  deleteAPIKey,
} = require('../middleware/apiKeyAuth');
const validate = require('../middleware/validate');
const { applyAuthRateLimiting } = require('../middleware/rateLimiting');

// Validation schemas
const {
  registerPasswordSchema,
  loginPasswordSchema,
} = require('../utils/validationSchemas');

// ============================================================================
// PASSWORD-BASED AUTHENTICATION
// ============================================================================

router.post(
  '/register',
  applyAuthRateLimiting,
  validate(registerPasswordSchema),
  register,
);

router.post(
  '/login',
  applyAuthRateLimiting,
  validate(loginPasswordSchema),
  login,
);

// ============================================================================
// VERIFICATION ENDPOINTS
// ============================================================================

// Verify email address
router.post('/verify/email', protect, applyAuthRateLimiting, verifyEmail);

// Verify phone number
router.post('/verify/phone', protect, applyAuthRateLimiting, verifyPhone);

// Firebase Synchronization
router.post('/firebase-sync', applyAuthRateLimiting, firebaseSync);

module.exports = router;
