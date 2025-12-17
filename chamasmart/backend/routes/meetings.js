const express = require("express");
const router = express.Router();
const {
  createMeeting,
  getChamaMeetings,
  getMeetingById,
  updateMeeting,
  recordAttendance,
} = require("../controllers/meetingController");
const { protect, isOfficial } = require("../middleware/auth");

// All routes are protected
router.post("/:chamaId/create", protect, isOfficial, createMeeting);
router.get("/:chamaId", protect, getChamaMeetings);
router.get("/:chamaId/:id", protect, getMeetingById);
router.put("/:chamaId/:id", protect, isOfficial, updateMeeting);
router.post("/:chamaId/:id/attendance", protect, isOfficial, recordAttendance);

module.exports = router;
