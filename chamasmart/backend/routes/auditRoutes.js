const express = require('express');

const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getUserLogs,
  getChamaLogs,
  getSecurityLogs,
  getChamaSummary,
  exportChamaLogs,
} = require('../controllers/auditController');
const { applyRateLimiting } = require('../middleware/rateLimiting');

// ============================================================================
// AUDIT LOG ROUTES WITH AUTHENTICATION & AUTHORIZATION
// ============================================================================

// User's own audit logs (users can see their own, admins can see any)
router.get('/users/:userId', protect, applyRateLimiting, getUserLogs);

// Chama audit logs (chama members and officials can view)
router.get(
  '/chamas/:chamaId',
  protect,
  authorize('member', 'admin', 'treasurer', 'chairperson'),
  getChamaLogs,
);

// Security events (admin only - critical security monitoring)
router.get('/security', protect, authorize('admin'), getSecurityLogs);

// Chama audit summary (chama officials only)
router.get(
  '/chamas/:chamaId/summary',
  protect,
  authorize('treasurer', 'chairperson', 'admin'),
  getChamaSummary,
);

// Export chama logs (officials only - with rate limiting to prevent abuse)
router.get(
  '/chamas/:chamaId/export',
  protect,
  authorize('treasurer', 'chairperson', 'admin'),
  applyRateLimiting,
  exportChamaLogs,
);

module.exports = router;
