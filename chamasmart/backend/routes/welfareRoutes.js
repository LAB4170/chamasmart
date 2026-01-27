const express = require("express");
const router = express.Router();
const welfareController = require("../controllers/welfareController");
const { protect, authorize } = require("../middleware/auth");
const upload = require("../middleware/upload");
const validate = require("../middleware/validate");
const {
  updateWelfareConfigSchema,
  submitClaimSchema,
  approveClaimSchema,
} = require("../utils/validationSchemas");
const { applyRateLimiting } = require("../middleware/rateLimiting");

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// WELFARE CONFIGURATION (Officials only)
// ============================================================================

// Get welfare configuration for a chama
router.get(
  "/:chamaId/config",
  authorize("member", "admin", "treasurer", "chairperson"),
  welfareController.getWelfareConfig,
);

// Update welfare configuration (admin/treasurer only)
router.put(
  "/:chamaId/config",
  authorize("admin", "treasurer"),
  validate(updateWelfareConfigSchema),
  welfareController.updateWelfareConfig,
);

// ============================================================================
// WELFARE FUND INFORMATION
// ============================================================================

// Get welfare fund information
router.get(
  "/:chamaId/fund",
  authorize("member", "admin", "treasurer", "chairperson"),
  welfareController.getWelfareFund,
);

// ============================================================================
// WELFARE CLAIMS MANAGEMENT
// ============================================================================

// Submit new welfare claim (with file upload and rate limiting)
router.post(
  "/:chamaId/claims",
  authorize("member", "admin", "treasurer", "chairperson"),
  applyRateLimiting,
  upload.single("proof_document"),
  validate(submitClaimSchema),
  welfareController.submitClaim,
);

// Get all claims for a chama (officials can see all)
router.get(
  "/:chamaId/claims",
  authorize("member", "admin", "treasurer", "chairperson"),
  welfareController.getChamaClaims,
);

// Get member's claims (members can see their own)
router.get(
  "/:chamaId/members/:memberId/claims",
  authorize("member", "admin", "treasurer", "chairperson"),
  welfareController.getMemberClaims,
);

// ============================================================================
// CLAIM APPROVAL (Officials only)
// ============================================================================

// Approve or reject claim
router.post(
  "/claims/:claimId/approve",
  authorize("admin", "treasurer", "chairperson"),
  validate(approveClaimSchema),
  welfareController.approveClaim,
);

module.exports = router;
