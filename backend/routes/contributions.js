const express = require('express');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  recordContribution,
  deleteContribution,
  getContributions,
  submitContribution,
  verifyContribution,
} = require('../controllers/contributionController');
const {
  contributionSchema,
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
  authorize('TREASURER', 'ADMIN'),
  applyFinancialRateLimiting,
  validate(contributionSchema),
  recordContribution,
);

// Submit new contribution (Member self-service)
router.post(
  '/:chamaId/submit',
  applyFinancialRateLimiting,
  validate(contributionSchema),
  submitContribution,
);

// Verify contribution (Treasurer/Official only)
router.post(
  '/:chamaId/verify/:id',
  authorize('TREASURER', 'CHAIRPERSON'),
  verifyContribution,
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
  authorize('ADMIN', 'TREASURER'),
  deleteContribution,
);

module.exports = router;
