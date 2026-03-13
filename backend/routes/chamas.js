const express = require('express');

const router = express.Router();
const {
  getAllChamas,
  getChamaById,
  createChama,
  updateChama,
  deleteChama,
  cancelDeleteChama,
  getMyChamas,
  getChamaMembers,
  getChamaStats,
  getPublicChamas,
} = require('../controllers/chamaController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createChamaSchema,
  updateChamaSchema,
} = require('../utils/validationSchemas');
const { applyRateLimiting } = require('../middleware/rateLimiting');
const { getChamaScore, getScoreHistory } = require('../controllers/creditBureauController');
const { getHealthAlerts } = require('../controllers/financialHealthController');

// ============================================================================
// PUBLIC ROUTES (no authentication required)
// ============================================================================

// Get all chamas (with pagination)
router.get('/', getAllChamas);

// Get public chamas (only chamas marked as public)
router.get('/public', getPublicChamas);

// ============================================================================
// PROTECTED ROUTES - SPECIFIC ROUTES BEFORE PARAMETERIZED
// ============================================================================

// Create new chama (authenticated users)
router.post(
  '/',
  protect,
  applyRateLimiting,
  validate(createChamaSchema),
  createChama,
);

// Get current user's chamas (MUST come before /:id)
router.get('/user/my-chamas', protect, getMyChamas);

// ============================================================================
// PARAMETERIZED ROUTES (come AFTER specific routes)
// ============================================================================

// Get chama by ID (protected route - as expected by tests)
router.get('/:chamaId', protect, getChamaById);

// Get chama members (members and officials only)
router.get(
  '/:chamaId/members',
  protect,
  authorize('member', 'admin', 'treasurer', 'chairperson'),
  getChamaMembers,
);

// Get chama statistics (members and officials only)
router.get(
  '/:chamaId/stats',
  protect,
  authorize('member', 'admin', 'treasurer', 'chairperson'),
  getChamaStats,
);

// ============================================================================
// OFFICIAL-ONLY ROUTES (admin, treasurer, chairperson)
// ============================================================================

// Update chama details
router.put(
  '/:chamaId',
  protect,
  authorize('admin', 'treasurer', 'chairperson'),
  validate(updateChamaSchema),
  updateChama,
);

// Deactivate chama (officials only with handshake)
router.delete('/:chamaId', protect, authorize('admin', 'chairperson', 'treasurer'), deleteChama);

// Cancel pending deactivation
router.post('/:chamaId/cancel-delete', protect, authorize('admin', 'chairperson', 'treasurer'), cancelDeleteChama);

// NEW: Analyze Reliability
router.post('/:chamaId/analyze-reliability', protect, authorize('admin', 'chairperson', 'treasurer'), async (req, res, next) => {
  try {
    const TrustScoreService = require('../utils/trustScoreService');
    const results = await TrustScoreService.analyzeChamaReliability(req.params.chamaId);
    res.json({
      success: true,
      message: 'Reliability analysis completed for all members',
      data: results
    });
  } catch (error) {
    next(error);
  }
});

// Credit Bureau: compute & cache score (accessible by all members)
router.get('/:chamaId/score', protect, authorize('member', 'admin', 'treasurer', 'chairperson', 'secretary'), getChamaScore);

// Credit Bureau: score history for sparkline
router.get('/:chamaId/score/history', protect, authorize('member', 'admin', 'treasurer', 'chairperson', 'secretary'), getScoreHistory);

// AI Health Coach: rule-based alerts
router.get('/:chamaId/health-alerts', protect, authorize('member', 'admin', 'treasurer', 'chairperson', 'secretary'), getHealthAlerts);

module.exports = router;
