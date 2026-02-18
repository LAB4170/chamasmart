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
const { registerSchema, loginSchema } = require("../utils/validationSchemas");

// Public routes
router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", refreshTokens); // NEW: Token refresh endpoint
router.post("/verify-email", verifyEmail);
router.post("/firebase-sync", firebaseSync); // NEW: Firebase sync endpoint

// Protected routes
router.get("/me", protect, (req, res) => res.json({ success: true, data: req.user }));
router.post("/logout", protect, logout); // NEW: Logout endpoint
router.post("/verify-phone", protect, verifyPhone);

module.exports = router;
