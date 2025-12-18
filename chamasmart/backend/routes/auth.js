const express = require("express");
const router = express.Router();
const { register, login, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { registerSchema, loginSchema } = require("../utils/validationSchemas");

// Public routes
router.post("/register", register); // Temporarily disable validation
router.post("/login", validate(loginSchema), login);

// Protected routes
router.get("/me", protect, getMe);

module.exports = router;
