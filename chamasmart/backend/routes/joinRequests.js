const express = require('express');

const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  requestToJoin,
  getJoinRequests,
  respondToRequest,
  getMyRequests,
} = require('../controllers/joinRequestController');
const validate = require('../middleware/validate');
const {
  requestToJoinSchema,
  respondToJoinRequestSchema,
} = require('../utils/validationSchemas');
const { applyRateLimiting } = require('../middleware/rateLimiting');

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// IMPORTANT: SPECIFIC ROUTES MUST COME BEFORE PARAMETERIZED ROUTES
// /my-requests must come before /:chamaId to prevent route shadowing
// ============================================================================

// ============================================================================
// USER-SPECIFIC ROUTES (FIRST - most specific)
// ============================================================================

// Get my own join requests
router.get('/my', getMyRequests);

// ============================================================================
// RESPONDING TO JOIN REQUESTS (Officials only)
// ============================================================================

// Respond to join request (approve/reject)
router.put(
  '/:requestId/respond',
  authorize('admin', 'treasurer', 'chairperson'),
  validate(respondToJoinRequestSchema),
  respondToRequest,
);

// ============================================================================
// CHAMA-SPECIFIC ROUTES (Parameterized - come after specific routes)
// ============================================================================

// Submit join request to a chama (with rate limiting)
router.post(
  '/:chamaId/request',
  applyRateLimiting,
  validate(requestToJoinSchema),
  requestToJoin,
);

// Get all join requests for a chama (officials only)
router.get(
  '/:chamaId',
  authorize('admin', 'treasurer', 'chairperson'),
  getJoinRequests,
);

module.exports = router;
