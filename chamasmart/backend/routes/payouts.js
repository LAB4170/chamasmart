const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getEligibleMembers,
  processPayout,
  getChamaPayouts,
  getPayoutById,
  cancelPayout,
  getPayoutSummary,
} = require("../controllers/payoutController");
const validate = require("../middleware/validate");
const { processPayoutSchema } = require("../utils/validationSchemas");
const { applyFinancialRateLimiting } = require("../middleware/rateLimiting");

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// PAYOUT INFORMATION (Members can view)
// ============================================================================

// Get eligible members for payout
router.get(
  "/:chamaId/eligible",
  authorize("member", "admin", "treasurer", "chairperson"),
  getEligibleMembers,
);

// Get all payouts for a chama
router.get(
  "/:chamaId",
  authorize("member", "admin", "treasurer", "chairperson"),
  getChamaPayouts,
);

// Get specific payout by ID
router.get(
  "/:chamaId/:payoutId",
  authorize("member", "admin", "treasurer", "chairperson"),
  getPayoutById,
);

// Get payout summary/statistics
router.get(
  "/:chamaId/summary",
  authorize("treasurer", "admin", "chairperson"),
  getPayoutSummary,
);

// ============================================================================
// PAYOUT PROCESSING (Officials only)
// ============================================================================

// Process payout (with rate limiting for financial ops)
router.post(
  "/:chamaId/process",
  authorize("treasurer", "admin"),
  applyFinancialRateLimiting,
  validate(processPayoutSchema),
  processPayout,
);

// Cancel pending payout (admin/treasurer only)
router.delete(
  "/:chamaId/:payoutId/cancel",
  authorize("treasurer", "admin"),
  cancelPayout,
);

module.exports = router;
