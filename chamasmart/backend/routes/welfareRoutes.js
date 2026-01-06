const express = require("express");
const router = express.Router();
const welfareController = require("../controllers/welfareController");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");

// Middleware to verify user is a member of the chama
const chamaMember = require("../middleware/chamaMember");

// Welfare Configuration Routes (Admin only)
router.get(
  "/:chamaId/config",
  auth,
  chamaMember,
  welfareController.getWelfareConfig
);
router.put("/config/:id", auth, welfareController.updateWelfareConfig);

// Welfare Fund Routes
router.get(
  "/:chamaId/fund",
  auth,
  chamaMember,
  welfareController.getWelfareFund
);

// Claim Routes
router.post(
  "/:chamaId/members/:memberId/claims",
  auth,
  chamaMember,
  upload.single("proof_document"),
  welfareController.submitClaim
);

router.get(
  "/:chamaId/members/:memberId/claims",
  auth,
  chamaMember,
  welfareController.getMemberClaims
);

// Approval Routes
router.post("/claims/:claimId/approve", auth, welfareController.approveClaim);

module.exports = router;
