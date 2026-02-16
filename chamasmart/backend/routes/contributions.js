const express = require('express');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  recordContribution,
  deleteContribution,
  getContributions,
} = require('../controllers/contributionController');
const {
  contributionSchema,
  updateContributionSchema,
} = require('../utils/validationSchemas');
const { applyFinancialRateLimiting } = require('../middleware/rateLimiting');

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// CONTRIBUTION RECORDING (Treasurer/Admin only)
// ============================================================================

// Record new contribution (with rate limiting for financial ops)
router.post(
  '/:chamaId/record',
  authorize('treasurer', 'admin'),
  applyFinancialRateLimiting,
  validate(contributionSchema),
  validate(contributionSchema),
  recordContribution,
);

// Get contributions
router.get(
  '/:chamaId',
  authorize('MEMBER', 'ADMIN', 'TREASURER', 'CHAIRPERSON'),
  getContributions,
);

// Delete contribution (admin only for safety)
router.delete(
  '/:chamaId/:id',
  authorize('admin', 'treasurer'),
  deleteContribution,
);

module.exports = router;
