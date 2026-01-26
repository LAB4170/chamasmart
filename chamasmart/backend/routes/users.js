const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  searchUser,
  getUserProfile,
  updateUserProfile,
  deleteUserAccount,
  getUserStats,
  changePassword,
} = require("../controllers/userController");
const validate = require("../middleware/validate");
const {
  updateUserProfileSchema,
  changePasswordSchema,
} = require("../utils/validationSchemas");
const { applyRateLimiting } = require("../middleware/rateLimiting");

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// USER SEARCH & DISCOVERY
// ============================================================================

// Search for users (with rate limiting to prevent abuse)
router.get("/search", applyRateLimiting, searchUser);

// ============================================================================
// USER PROFILE MANAGEMENT
// ============================================================================

// Get user profile by ID (or own profile if no ID specified)
router.get("/profile/:userId?", getUserProfile);

// Update user profile
router.put("/profile", validate(updateUserProfileSchema), updateUserProfile);

// Get user statistics (contributions, loans, chamas, etc.)
router.get("/stats", getUserStats);

// ============================================================================
// ACCOUNT SECURITY
// ============================================================================

// Change password
router.put(
  "/change-password",
  applyRateLimiting,
  validate(changePasswordSchema),
  changePassword,
);

// Delete user account (requires confirmation)
router.delete("/account", applyRateLimiting, deleteUserAccount);

module.exports = router;
