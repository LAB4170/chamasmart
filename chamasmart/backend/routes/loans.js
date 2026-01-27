const express = require('express');

const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  applyForLoan,
  getChamaLoans,
  getLoanById,
  approveLoan,
  rejectLoan,
  makeRepayment,
  getUserLoans,
} = require('../controllers/loanController');
const validate = require('../middleware/validate');
const { applyLoanSchema } = require('../utils/validationSchemas');
const { applyFinancialRateLimiting } = require('../middleware/rateLimiting');

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// USER LOAN ENDPOINTS
// ============================================================================

// Get user's loan history
router.get('/my-loans', getUserLoans);

// ============================================================================
// CHAMA LOAN MANAGEMENT
// ============================================================================

// Get all loans for a chama
router.get(
  '/:chamaId',
  authorize('member', 'admin', 'treasurer', 'chairperson'),
  getChamaLoans,
);

// Get specific loan details
router.get(
  '/:chamaId/:loanId',
  authorize('member', 'admin', 'treasurer', 'chairperson'),
  getLoanById,
);

// Apply for a loan (with financial rate limiting)
router.post(
  '/:chamaId/apply',
  authorize('member'),
  applyFinancialRateLimiting,
  validate(applyLoanSchema),
  applyForLoan,
);

// ============================================================================
// LOAN APPROVAL/REJECTION (Officials only)
// ============================================================================

// Approve loan application
router.put(
  '/:chamaId/:loanId/approve',
  authorize('admin', 'treasurer', 'chairperson'),
  approveLoan,
);

// Reject loan application
router.put(
  '/:chamaId/:loanId/reject',
  authorize('admin', 'treasurer', 'chairperson'),
  rejectLoan,
);

// ============================================================================
// LOAN REPAYMENTS
// ============================================================================

// Make loan repayment
router.post(
  '/:chamaId/:loanId/repay',
  applyFinancialRateLimiting,
  makeRepayment,
);

module.exports = router;
