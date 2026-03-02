const express = require("express");
const router = express.Router();
const {
  register,
  login,
  verifyEmail,
  verifyPhone,
  refreshTokens,
  logout,
  firebaseSync,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { applyAuthRateLimiting } = require("../middleware/rateLimiting");
const { 
  registerPasswordSchema, 
  loginPasswordSchema 
} = require("../utils/validationSchemas");

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

router.post("/register", applyAuthRateLimiting, validate(registerPasswordSchema), register);
router.post("/login", applyAuthRateLimiting, validate(loginPasswordSchema), login);
router.post("/refresh", applyAuthRateLimiting, refreshTokens);
router.post("/firebase-sync", applyAuthRateLimiting, firebaseSync);

// ============================================================================
// PROTECTED ROUTES
// ============================================================================

router.get("/me", protect, (req, res) => res.json({ success: true, data: req.user }));
router.post("/logout", protect, logout);
router.post("/verify-email", protect, applyAuthRateLimiting, verifyEmail);
router.post("/verify-phone", protect, applyAuthRateLimiting, verifyPhone);

module.exports = router;
