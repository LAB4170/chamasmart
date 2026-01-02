const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getMe,
  verifyEmail,
  verifyPhone,
  resendEmailVerification,
  resendPhoneVerification,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { registerSchema, loginSchema } = require("../utils/validationSchemas");

// Public routes
router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/verify-email", verifyEmail);

// Protected routes
router.get("/me", protect, getMe);
router.post("/verify-phone", protect, verifyPhone);
router.post(
  "/resend-email-verification",
  protect,
  resendEmailVerification
);
router.post(
  "/resend-phone-verification",
  protect,
  resendPhoneVerification
);

module.exports = router;
