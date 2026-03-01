const express = require('express');
const router = express.Router();
const { calculateDividends, distributeDividends } = require('../controllers/dividendController');
const { protect, authorize } = require('../middleware/auth');

// All dividend routes require authentication and Chama official status
router.use(protect);

router.get('/:chamaId/calculate/:cycleId', authorize('CHAIRPERSON', 'TREASURER'), calculateDividends);
router.post('/:chamaId/distribute/:cycleId', authorize('CHAIRPERSON', 'TREASURER'), distributeDividends);

module.exports = router;
