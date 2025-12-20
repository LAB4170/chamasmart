const express = require('express');
const router = express.Router();
const { protect, isOfficial } = require('../middleware/auth');
const {
    getEligibleMembers,
    processPayout,
    getChamaPayouts
} = require('../controllers/payoutController');

router.get('/:chamaId/eligible', protect, getEligibleMembers);
router.post('/:chamaId/process', protect, isOfficial, processPayout);
router.get('/:chamaId', protect, getChamaPayouts);

module.exports = router;
