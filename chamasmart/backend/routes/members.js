const express = require("express");
const router = express.Router();
const {
  addMember,
  updateMemberRole,
  removeMember,
  getMemberContributions,
  getMemberDetails,
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

module.exports = router;
