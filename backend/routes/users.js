const express = require('express');

const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  searchUser,
  getProfile,
  updateProfile,
  changePassword,
  deactivateAccount,
} = require('../controllers/userController');
const { applyRateLimiting } = require('../middleware/rateLimiting');
const validate = require('../middleware/validate');
const {
  updateProfileSchema,
  changePasswordSchema,
} = require('../utils/validationSchemas');

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// USER PROFILE MANAGEMENT
// ============================================================================

// Get current user profile
router.get('/profile', getProfile);

// Update user profile
router.put(
  '/profile',
  applyRateLimiting,
  validate(updateProfileSchema),
  updateProfile,
);

// Change password
router.put(
  '/change-password',
  applyRateLimiting,
  validate(changePasswordSchema),
  changePassword,
);

// Deactivate account
router.delete('/account', applyRateLimiting, deactivateAccount);

// ============================================================================
// USER SEARCH
// ============================================================================

// Search for users (with rate limiting)
router.get('/search', applyRateLimiting, searchUser);

module.exports = router;
