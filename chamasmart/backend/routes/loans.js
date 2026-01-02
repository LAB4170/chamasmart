const express = require('express');
const router = express.Router();
const { protect, isTreasurer } = require('../middleware/auth');
const {
    applyForLoan,
    getChamaLoans,
    respondToLoan,
    repayLoan,
    getLoanConfig,
    updateLoanConfig,
    getLoanGuarantors,
    getMyGuarantees,
    respondToGuarantor,
    exportLoansReport,
} = require('../controllers/loanController');

// Loan configuration ("constitution")
router.get('/:chamaId/config', protect, getLoanConfig);
router.put('/:chamaId/config', protect, isTreasurer, updateLoanConfig);

// Current user's guarantees
router.get('/my/guarantees', protect, getMyGuarantees);

// Reports (treasurer-only)
router.get('/:chamaId/report', protect, isTreasurer, exportLoansReport);

// Core loan flows
router.post('/:chamaId/apply', protect, applyForLoan);
router.get('/:chamaId', protect, getChamaLoans);

// Guarantor flows
router.get('/:loanId/guarantors', protect, getLoanGuarantors);
router.post('/:loanId/guarantors/respond', protect, respondToGuarantor);

// Treasurer approval & repayments
router.put('/:loanId/approve', protect, respondToLoan);
router.post('/:loanId/repay', protect, repayLoan);

module.exports = router;
