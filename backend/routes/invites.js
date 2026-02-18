const express = require('express');

const router = express.Router();
const {
  generateInvite,
  joinWithInvite,
  getChamaInvites,
  deactivateInvite,
  sendInvite,
} = require('../controllers/inviteController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  generateInviteSchema,
  sendInviteSchema,
  joinWithInviteSchema,
} = require('../utils/validationSchemas');
const { applyRateLimiting } = require('../middleware/rateLimiting');

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// INVITE GENERATION (Officials only)
// ============================================================================

// Generate new invite code
router.post(
  '/:chamaId/generate',
  authorize('admin', 'treasurer', 'chairperson'),
  applyRateLimiting,
  validate(generateInviteSchema),
  generateInvite,
);

// Send invite via email/SMS
router.post(
  '/:chamaId/send',
  authorize('admin', 'treasurer', 'chairperson'),
  applyRateLimiting,
  validate(sendInviteSchema),
  sendInvite,
);

// Get all invites for a chama
router.get(
  '/:chamaId',
  authorize('admin', 'treasurer', 'chairperson'),
  getChamaInvites,
);

// Deactivate/revoke an invite
router.delete(
  '/:inviteId',
  authorize('admin', 'treasurer', 'chairperson'),
  deactivateInvite,
);

// ============================================================================
// JOINING WITH INVITE (Any authenticated user)
// ============================================================================

// Join chama using invite code
router.post(
  '/join',
  applyRateLimiting,
  validate(joinWithInviteSchema),
  joinWithInvite,
);

module.exports = router;
