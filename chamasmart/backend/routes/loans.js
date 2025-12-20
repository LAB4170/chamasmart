const express = require('express');
const router = express.Router();
const { protect, isOfficial } = require('../middleware/auth');
const {
    applyForLoan,
    getChamaLoans,
    respondToLoan,
    repayLoan
} = require('../controllers/loanController');

router.post('/:chamaId/apply', protect, applyForLoan);
router.get('/:chamaId', protect, getChamaLoans);
router.put('/:loanId/approve', protect, isOfficial, respondToLoan);
router.post('/:loanId/repay', protect, repayLoan);

module.exports = router;
