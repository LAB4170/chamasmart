const express = require('express');

const router = express.Router();
const {
  addMember,
  updateMemberRole,
  removeMember,
  getMemberContributions,
  getMemberDetails,
} = require('../controllers/memberController');
const { protect, authorize, isSecretary, isOfficial } = require('../middleware/auth');
const validate = require('../middleware/validate');

const { applyRateLimiting } = require('../middleware/rateLimiting');

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// MEMBER MANAGEMENT (Officials only)
// ============================================================================

// Add new member to chama (Secretaries & Chairs)
router.post(
  '/:chamaId/add',
  isSecretary,
  applyRateLimiting,
  addMember,
);

// Update member's role (Secretaries & Chairs)
router.put(
  '/:chamaId/role/:userId',
  isSecretary,
  updateMemberRole,
);

// Remove member (Secretaries & Chairs)
router.delete('/:chamaId/remove/:userId', isSecretary, removeMember);

// ============================================================================
// MEMBER INFORMATION (All members can view)
// ============================================================================

// Get member's contribution history
router.get(
  '/:chamaId/contributions/:userId',
  authorize('member', 'admin', 'treasurer', 'chairperson'),
  getMemberContributions,
);

module.exports = router;
