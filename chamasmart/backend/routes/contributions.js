const express = require("express");
const router = express.Router();
const {
  recordContribution,
  deleteContribution,
} = require("../controllers/contributionController");
const { protect, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");
const {
  contributionSchema,
  updateContributionSchema,
} = require("../utils/validationSchemas");
const { applyFinancialRateLimiting } = require("../middleware/rateLimiting");

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// CONTRIBUTION RECORDING (Treasurer/Admin only)
// ============================================================================

// Record new contribution (with rate limiting for financial ops)
router.post(
  "/:chamaId/record",
  authorize("treasurer", "admin"),
  applyFinancialRateLimiting,
  validate(contributionSchema),
  recordContribution,
);

// Delete contribution (admin only for safety)
router.delete(
  "/:chamaId/:id",
  authorize("admin", "treasurer"),
  deleteContribution,
);

module.exports = router;
