const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  createCycle,
  getChamaCycles,
  getCycleById,
  deleteCycle,
  getCycleRoster,
  processPayout,
  requestPositionSwap,
  respondToSwapRequest,
  getSwapRequests,
  updateCycleRoster,
} = require("../controllers/roscaController");
const validate = require("../middleware/validate");
const {
  createCycleSchema,
  processPayoutSchema,
  requestPositionSwapSchema,
  respondToSwapRequestSchema,
  updateCycleRosterSchema,
} = require("../utils/validationSchemas");
const {
  applyFinancialRateLimiting,
  applyRateLimiting,
} = require("../middleware/rateLimiting");

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// ROSCA CYCLE MANAGEMENT
// ============================================================================

// Get all cycles for a chama
router.get(
  "/chama/:chamaId/cycles",
  authorize("member", "admin", "treasurer", "chairperson"),
  getChamaCycles,
);

// Create new ROSCA cycle (officials only)
router.post(
  "/chama/:chamaId/cycles",
  authorize("admin", "treasurer", "chairperson"),
  applyRateLimiting,
  validate(createCycleSchema),
  createCycle,
);

// Get specific cycle by ID
router.get(
  "/cycles/:cycleId",
  authorize("member", "admin", "treasurer", "chairperson"),
  getCycleById,
);

// Delete cycle (admin only)
router.delete("/cycles/:cycleId", authorize("admin", "treasurer"), deleteCycle);

// ============================================================================
// CYCLE ROSTER MANAGEMENT
// ============================================================================

// Get cycle roster (payout order)
router.get(
  "/cycles/:cycleId/roster",
  authorize("member", "admin", "treasurer", "chairperson"),
  getCycleRoster,
);

// Update cycle roster (officials only)
router.put(
  "/cycles/:cycleId/roster",
  authorize("admin", "treasurer", "chairperson"),
  validate(updateCycleRosterSchema),
  updateCycleRoster,
);

// ============================================================================
// PAYOUT PROCESSING
// ============================================================================

// Process payout for current cycle position (treasurer only)
router.post(
  "/cycles/:cycleId/payout",
  authorize("treasurer", "admin"),
  applyFinancialRateLimiting,
  validate(processPayoutSchema),
  processPayout,
);

// ============================================================================
// POSITION SWAP REQUESTS
// ============================================================================

// Request position swap with another member
router.post(
  "/cycles/:cycleId/swap-request",
  authorize("member", "admin", "treasurer", "chairperson"),
  applyRateLimiting,
  validate(requestPositionSwapSchema),
  requestPositionSwap,
);

// Get all swap requests (for user or chama)
router.get(
  "/swap-requests",
  authorize("member", "admin", "treasurer", "chairperson"),
  getSwapRequests,
);

// Respond to swap request (accept/reject)
router.put(
  "/swap-requests/:requestId/respond",
  authorize("member", "admin", "treasurer", "chairperson"),
  validate(respondToSwapRequestSchema),
  respondToSwapRequest,
);

module.exports = router;
