const express = require("express");
const router = express.Router();
const { protect, isTreasurer } = require("../middleware/auth");
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
} = require("../controllers/loanController");

const validate = require("../middleware/validate");
const { applyLoanSchema } = require("../utils/validationSchemas");

// IMPORTANT: Specific routes MUST come BEFORE parameterized routes to prevent route shadowing
// Otherwise, /my/guarantees will be treated as /:chamaId with chamaId="my"

// Current user's specific routes (FIRST - most specific)
router.get("/my/guarantees", protect, getMyGuarantees);

// Loan configuration ("constitution")
router.get("/:chamaId/config", protect, getLoanConfig);
router.put("/:chamaId/config", protect, isTreasurer, updateLoanConfig);

// Reports (treasurer-only)
router.get("/:chamaId/report", protect, isTreasurer, exportLoansReport);

// Core loan flows
router.post(
  "/:chamaId/apply",
  protect,
  validate(applyLoanSchema),
  applyForLoan
);
router.get("/:chamaId", protect, getChamaLoans);

// Guarantor flows (nested resources)
router.get("/:loanId/guarantors", protect, getLoanGuarantors);
router.post("/:loanId/guarantors/respond", protect, respondToGuarantor);

// Treasurer approval & repayments
router.put("/:loanId/approve", protect, respondToLoan);
router.post("/:loanId/repay", protect, repayLoan);

module.exports = router;
