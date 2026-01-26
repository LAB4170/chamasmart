const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
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
  getMyLoans,
  getLoanById,
} = require("../controllers/loanController");
const validate = require("../middleware/validate");
const {
  applyLoanSchema,
  updateLoanConfigSchema,
  respondToLoanSchema,
  repayLoanSchema,
  respondToGuarantorSchema,
} = require("../utils/validationSchemas");
const {
  applyFinancialRateLimiting,
  applyRateLimiting,
} = require("../middleware/rateLimiting");

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// IMPORTANT: SPECIFIC ROUTES MUST COME BEFORE PARAMETERIZED ROUTES
// Otherwise, /my/guarantees will be treated as /:chamaId
// ============================================================================

// ============================================================================
// CURRENT USER'S SPECIFIC ROUTES (FIRST - most specific)
// ============================================================================

// Get current user's guarantees across all chamas
router.get("/my/guarantees", getMyGuarantees);

// Get current user's loans across all chamas
router.get("/my/loans", getMyLoans);

// ============================================================================
// LOAN CONFIGURATION ROUTES
// ============================================================================

// Get loan configuration/constitution for a chama
router.get(
  "/:chamaId/config",
  authorize("member", "admin", "treasurer", "chairperson"),
  getLoanConfig,
);

// Update loan configuration (officials only)
router.put(
  "/:chamaId/config",
  authorize("admin", "treasurer"),
  validate(updateLoanConfigSchema),
  updateLoanConfig,
);

// ============================================================================
// REPORTS & EXPORTS (Officials only)
// ============================================================================

// Export loans report (with rate limiting)
router.get(
  "/:chamaId/report",
  authorize("treasurer", "admin", "chairperson"),
  applyRateLimiting,
  exportLoansReport,
);

// ============================================================================
// CORE LOAN OPERATIONS
// ============================================================================

// Apply for loan (with rate limiting for financial ops)
router.post(
  "/:chamaId/apply",
  authorize("member", "admin", "treasurer", "chairperson"),
  applyFinancialRateLimiting,
  validate(applyLoanSchema),
  applyForLoan,
);

// Get all loans for a chama
router.get(
  "/:chamaId",
  authorize("member", "admin", "treasurer", "chairperson"),
  getChamaLoans,
);

// Get specific loan by ID
router.get(
  "/:chamaId/loans/:loanId",
  authorize("member", "admin", "treasurer", "chairperson"),
  getLoanById,
);

// ============================================================================
// GUARANTOR OPERATIONS (nested resources)
// ============================================================================

// Get guarantors for a specific loan
router.get(
  "/:loanId/guarantors",
  authorize("member", "admin", "treasurer", "chairperson"),
  getLoanGuarantors,
);

// Respond to guarantor request (accept/decline)
router.post(
  "/:loanId/guarantors/respond",
  validate(respondToGuarantorSchema),
  respondToGuarantor,
);

// ============================================================================
// TREASURER OPERATIONS (Approval & Management)
// ============================================================================

// Approve or reject loan application
router.put(
  "/:loanId/approve",
  authorize("treasurer", "admin"),
  validate(respondToLoanSchema),
  respondToLoan,
);

// Record loan repayment (with rate limiting)
router.post(
  "/:loanId/repay",
  authorize("treasurer", "admin", "member"),
  applyFinancialRateLimiting,
  validate(repayLoanSchema),
  repayLoan,
);

module.exports = router;
