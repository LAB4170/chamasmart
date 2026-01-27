const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getEligibleMembers,
  processPayout,
  getChamaPayouts,
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

// Process payout (with rate limiting for financial ops)
router.post(
  "/:chamaId/process",
  authorize("treasurer", "admin"),
  applyFinancialRateLimiting,
  validate(processPayoutSchema),
  processPayout,
);

module.exports = router;
