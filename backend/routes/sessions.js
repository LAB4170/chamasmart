const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  openSession,
  getSessionData,
  closeSession,
  addLivePenalty,
  getSessionPenalties
} = require('../controllers/tableSessionController');

router.use(protect);

// Session Endpoints (Treasurer/Chama Specific)
router.post('/:chamaId/:meetingId/open', authorize('TREASURER', 'CHAIRPERSON', 'ADMIN'), openSession);
router.get('/:chamaId/:meetingId/data', getSessionData);
router.post('/:chamaId/:meetingId/close', authorize('TREASURER', 'CHAIRPERSON', 'ADMIN'), closeSession);

// Phase 22: Live Session Penalties
router.post('/:chamaId/:meetingId/penalties', authorize('SECRETARY', 'CHAIRPERSON', 'ADMIN'), addLivePenalty);
router.get('/:chamaId/:meetingId/penalties', getSessionPenalties);

module.exports = router;
