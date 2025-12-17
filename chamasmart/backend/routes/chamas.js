const express = require("express");
const router = express.Router();
const {
  getAllChamas,
  getChamaById,
  createChama,
  updateChama,
  deleteChama,
  getMyChamas,
  getChamaMembers,
  getChamaStats,
} = require("../controllers/chamaController");
const { protect, isOfficial } = require("../middleware/auth");

// Public routes (view chamas)
router.get("/", getAllChamas);
router.get("/:id", getChamaById);

// Protected routes
router.post("/", protect, createChama);
router.get("/user/my-chamas", protect, getMyChamas);
router.get("/:id/members", protect, getChamaMembers);
router.get("/:id/stats", protect, getChamaStats);

// Official-only routes
router.put("/:chamaId", protect, isOfficial, updateChama);
router.delete("/:chamaId", protect, isOfficial, deleteChama);

module.exports = router;
