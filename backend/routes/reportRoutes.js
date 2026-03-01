const express = require('express');
const router = express.Router();
const { getAuditReport } = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

// Audit reports require authentication and Chama official status (Chairperson or auditor-equivalent)
router.use(protect);

router.get('/:chamaId/audit', authorize('CHAIRPERSON', 'TREASURER', 'SECRETARY'), getAuditReport);

module.exports = router;
