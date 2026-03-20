const express = require('express');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  recordContribution,
  bulkRecordContributions,
  deleteContribution,
  getContributions,
  submitContribution,
  verifyContribution,
  getPendingContributions,
} = require('../controllers/contributionController');
const {
  contributionSchema,
  bulkContributionSchema,
} = require('../utils/validationSchemas');
const { applyFinancialRateLimiting } = require('../middleware/rateLimiting');

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// CONTRIBUTION RECORDING (Treasurer/Admin only)
// ============================================================================

router.post(
  '/:chamaId/record',
  authorize('TREASURER', 'ADMIN'),
  applyFinancialRateLimiting,
  validate(contributionSchema),
  recordContribution,
);

router.post(
  '/:chamaId/bulk-record',
  authorize('TREASURER', 'CHAIRPERSON', 'SECRETARY', 'ADMIN'),
  applyFinancialRateLimiting,
  validate(bulkContributionSchema),
  bulkRecordContributions,
);

// Submit manual contribution (Member self-service — submits receipt after paying)
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

// Get all pending manual contributions (Admin/Treasurer)
router.get(
  '/:chamaId/pending',
  authorize('TREASURER', 'CHAIRPERSON', 'ADMIN'),
  getPendingContributions,
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
