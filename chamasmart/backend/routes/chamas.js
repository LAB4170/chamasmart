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
  getPublicChamas,
} = require("../controllers/chamaController");
const { protect, isOfficial } = require("../middleware/auth");

const validate = require("../middleware/validate");
const { createChamaSchema, updateChamaSchema } = require("../utils/validationSchemas");

// Public routes (view chamas)
router.get("/", getAllChamas);
router.get("/public", getPublicChamas);

// Protected routes - SPECIFIC routes MUST come before parameterized routes
router.post("/", protect, validate(createChamaSchema), createChama);
router.get("/user/my-chamas", protect, getMyChamas);

// Parameterized routes - these come AFTER specific routes
router.get("/:id", getChamaById);
router.get("/:id/members", protect, getChamaMembers);
router.get("/:id/stats", protect, getChamaStats);

// Official-only routes
router.put("/:chamaId", protect, isOfficial, validate(updateChamaSchema), updateChama);
router.delete("/:chamaId", protect, isOfficial, deleteChama);

module.exports = router;
