const express = require('express');

const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createCycle,
  getChamaCycles,
  getCycleRoster,
  processPayout,
  requestPositionSwap,
  respondToSwapRequest,
  getSwapRequests,
  cancelCycle,
  getCycleById,
  deleteCycle,
  activateCycle,
  makeContribution,
  getContributions,
  getMemberStatement,
} = require('../controllers/roscaController');
const validate = require('../middleware/validate');
const {
  createCycleSchema,
  processPayoutSchema,
  requestPositionSwapSchema,
  respondToSwapRequestSchema,
  updateCycleRosterSchema,
} = require('../utils/validationSchemas');
const {
  applyFinancialRateLimiting,
  applyRateLimiting,
} = require('../middleware/rateLimiting');

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// ROSCA CYCLE MANAGEMENT
// ============================================================================

// Get all cycles for a chama (all members can view)
router.get(
  '/chama/:chamaId/cycles',
  authorize('MEMBER', 'ADMIN', 'TREASURER', 'CHAIRPERSON', 'SECRETARY'),
  getChamaCycles,
);

// Create new ROSCA cycle (officials only)
router.post(
  '/chama/:chamaId/cycles',
  authorize('ADMIN', 'TREASURER', 'CHAIRPERSON', 'SECRETARY'),
  applyRateLimiting,
  validate(createCycleSchema),
  createCycle,
);

// Delete cycle (admin/treasurer)
router.delete('/cycles/:cycleId', authorize('ADMIN', 'TREASURER', 'CHAIRPERSON'), deleteCycle);

// Get specific cycle details
router.get(
  '/cycles/:cycleId',
  authorize('MEMBER', 'ADMIN', 'TREASURER', 'CHAIRPERSON', 'SECRETARY'),
  getCycleById,
);

// Activate cycle (officials only)
router.put(
  '/cycles/:cycleId/activate',
  authorize('ADMIN', 'TREASURER', 'CHAIRPERSON', 'SECRETARY'),
  activateCycle,
);

// Cancel cycle (officials only)
router.put(
  '/cycles/:cycleId/cancel',
  authorize('ADMIN', 'TREASURER', 'CHAIRPERSON', 'SECRETARY'),
  cancelCycle,
);

// Get cycle roster (payout order) - all members
router.get(
  '/cycles/:cycleId/roster',
  authorize('MEMBER', 'ADMIN', 'TREASURER', 'CHAIRPERSON', 'SECRETARY'),
  getCycleRoster,
);

// ============================================================================
// CONTRIBUTIONS AND LEDGERS
// ============================================================================

// Make a ROSCA contribution
router.post(
  '/chama/:chamaId/cycles/:cycleId/contributions',
  authorize('MEMBER', 'ADMIN', 'TREASURER', 'CHAIRPERSON', 'SECRETARY'),
  applyFinancialRateLimiting,
  makeContribution,
);

// Get all contributions for a cycle
router.get(
  '/cycles/:cycleId/contributions',
  authorize('MEMBER', 'ADMIN', 'TREASURER', 'CHAIRPERSON', 'SECRETARY'),
  getContributions,
);

// Get member statement for a cycle
router.get(
  '/cycles/:cycleId/members/:memberId/statement',
  authorize('MEMBER', 'ADMIN', 'TREASURER', 'CHAIRPERSON', 'SECRETARY'),
  getMemberStatement,
);

// ============================================================================
// PAYOUT PROCESSING
// ============================================================================

// Process payout for current cycle position (treasurer/chairperson)
router.post(
  '/cycles/:cycleId/payout',
  authorize('TREASURER', 'ADMIN', 'CHAIRPERSON'),
  applyFinancialRateLimiting,
  validate(processPayoutSchema),
  processPayout,
);

// ============================================================================
// POSITION SWAP REQUESTS
// ============================================================================

// Request position swap with another member
router.post(
  '/cycles/:cycleId/swap-request',
  authorize('MEMBER', 'ADMIN', 'TREASURER', 'CHAIRPERSON', 'SECRETARY'),
  applyRateLimiting,
  validate(requestPositionSwapSchema),
  requestPositionSwap,
);

// Get all swap requests (for user or chama)
router.get(
  '/swap-requests',
  authorize('MEMBER', 'ADMIN', 'TREASURER', 'CHAIRPERSON', 'SECRETARY'),
  getSwapRequests,
);

// Respond to swap request (accept/reject)
router.put(
  '/swap-requests/:requestId/respond',
  authorize('MEMBER', 'ADMIN', 'TREASURER', 'CHAIRPERSON', 'SECRETARY'),
  validate(respondToSwapRequestSchema),
  respondToSwapRequest,
);

module.exports = router;

