const express = require("express");
const router = express.Router();
const {
  addMember,
  updateMemberRole,
  removeMember,
  getMemberContributions,
  getMemberDetails,
  suspendMember,
  reactivateMember,
} = require("../controllers/memberController");
const { protect, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");
const {
  addMemberSchema,
  updateMemberRoleSchema,
} = require("../utils/validationSchemas");
const { applyRateLimiting } = require("../middleware/rateLimiting");

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// MEMBER MANAGEMENT (Officials only)
// ============================================================================

// Add new member to chama
router.post(
  "/:chamaId/add",
  authorize("admin", "treasurer", "chairperson"),
  applyRateLimiting,
  validate(addMemberSchema),
  addMember,
);

// Update member's role
router.put(
  "/:chamaId/role/:userId",
  authorize("admin", "chairperson"),
  validate(updateMemberRoleSchema),
  updateMemberRole,
);

// Suspend member (temporary removal)
router.put(
  "/:chamaId/suspend/:userId",
  authorize("admin", "chairperson"),
  suspendMember,
);

// Reactivate suspended member
router.put(
  "/:chamaId/reactivate/:userId",
  authorize("admin", "chairperson"),
  reactivateMember,
);

// Remove member permanently (admin only for safety)
router.delete("/:chamaId/remove/:userId", authorize("admin"), removeMember);

// ============================================================================
// MEMBER INFORMATION (All members can view)
// ============================================================================

// Get member's contribution history
router.get(
  "/:chamaId/contributions/:userId",
  authorize("member", "admin", "treasurer", "chairperson"),
  getMemberContributions,
);

// Get member details
router.get(
  "/:chamaId/:userId",
  authorize("member", "admin", "treasurer", "chairperson"),
  getMemberDetails,
);

module.exports = router;
