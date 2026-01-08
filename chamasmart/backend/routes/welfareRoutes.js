const express = require("express");
const router = express.Router();
const welfareController = require("../controllers/welfareController");
const { protect } = require("../middleware/auth");
const upload = require("../middleware/upload");

// Middleware to verify user is a member of the chama
const chamaMember = require("../middleware/chamaMember");

// Welfare Configuration Routes (Admin only)
router.get(
  "/:chamaId/config",
  protect,
  chamaMember,
  welfareController.getWelfareConfig
);
router.put("/config/:id", protect, welfareController.updateWelfareConfig);

// Welfare Fund Routes
router.get(
  "/:chamaId/fund",
  protect,
  chamaMember,
  welfareController.getWelfareFund
);

// Claim Routes
router.post(
  "/:chamaId/members/:memberId/claims",
  protect,
  chamaMember,
  upload.single("proof_document"),
  welfareController.submitClaim
);

router.get(
  "/:chamaId/members/:memberId/claims",
  protect,
  chamaMember,
  welfareController.getMemberClaims
);

router.get(
  "/:chamaId/claims",
  protect,
  chamaMember,
  welfareController.getChamaClaims
);

// Approval Routes
router.post("/claims/:claimId/approve", protect, welfareController.approveClaim);

module.exports = router;
