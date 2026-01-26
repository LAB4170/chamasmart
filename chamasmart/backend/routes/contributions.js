const express = require("express");
const router = express.Router();
const {
  recordContribution,
  getChamaContributions,
  getContributionById,
  updateContribution,
  deleteContribution,
  getMemberContributionSummary,
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

// Update existing contribution
router.put(
  "/:chamaId/:id",
  authorize("treasurer", "admin"),
  validate(updateContributionSchema),
  updateContribution,
);

// Delete contribution (admin only for safety)
router.delete(
  "/:chamaId/:id",
  authorize("admin", "treasurer"),
  deleteContribution,
);

// ============================================================================
// VIEWING CONTRIBUTIONS (All members)
// ============================================================================

// Get all contributions for a chama
router.get(
  "/:chamaId",
  authorize("member", "admin", "treasurer", "chairperson"),
  getChamaContributions,
);

// Get specific contribution by ID
router.get(
  "/:chamaId/:id",
  authorize("member", "admin", "treasurer", "chairperson"),
  getContributionById,
);

// Get member's contribution summary
router.get(
  "/:chamaId/member/:userId/summary",
  authorize("member", "admin", "treasurer", "chairperson"),
  getMemberContributionSummary,
);

module.exports = router;
