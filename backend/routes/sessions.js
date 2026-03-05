const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  openSession,
  getSessionData,
  closeSession
} = require('../controllers/tableSessionController');

router.use(protect);

// Session Endpoints (Treasurer/Chama Specific)
router.post('/:chamaId/:meetingId/open', authorize('TREASURER', 'CHAIRPERSON', 'ADMIN'), openSession);
router.get('/:chamaId/:meetingId/data', getSessionData);
router.post('/:chamaId/:meetingId/close', authorize('TREASURER', 'CHAIRPERSON', 'ADMIN'), closeSession);

module.exports = router;
