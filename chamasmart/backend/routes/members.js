const express = require("express");
const router = express.Router();
const {
  addMember,
  updateMemberRole,
  removeMember,
  getMemberContributions,
} = require("../controllers/memberController");
const { protect, isOfficial } = require("../middleware/auth");

// All routes are protected and require official status
router.post("/:chamaId/add", protect, isOfficial, addMember);
router.put("/:chamaId/role/:userId", protect, isOfficial, updateMemberRole);
router.delete("/:chamaId/remove/:userId", protect, isOfficial, removeMember);
router.get("/:chamaId/contributions/:userId", protect, getMemberContributions);

module.exports = router;
