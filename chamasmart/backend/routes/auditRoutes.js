const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getUserLogs,
  getChamaLogs,
  getSecurityLogs,
  getChamaSummary,
  exportChamaLogs,
} = require("../controllers/auditController");

// ============================================================================
// ROUTES WITH AUTHENTICATION & AUTHORIZATION
// ============================================================================

// User's own audit logs (user can see their own, admin can see any)
router.get("/users/:userId", protect, getUserLogs);

// Chama audit logs (chama members can view)
router.get(
  "/chamas/:chamaId",
  protect,
  authorize("member", "admin"),
  getChamaLogs,
);

// Security events (admin only)
router.get("/security", protect, authorize("admin"), getSecurityLogs);

// Chama audit summary (chama officials)
router.get(
  "/chamas/:chamaId/summary",
  protect,
  authorize("treasurer", "chairperson", "admin"),
  getChamaSummary,
);

// Export chama logs (treasurer/chairperson only)
router.get(
  "/chamas/:chamaId/export",
  protect,
  authorize("treasurer", "chairperson", "admin"),
  exportChamaLogs,
);

module.exports = router;
