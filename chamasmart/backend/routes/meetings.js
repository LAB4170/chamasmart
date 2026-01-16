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

const validate = require("../middleware/validate");
const {
  createMeetingSchema,
  updateMeetingSchema,
} = require("../utils/validationSchemas");

// All routes are protected
router.post(
  "/:chamaId/create",
  protect,
  isOfficial,
  validate(createMeetingSchema),
  createMeeting
);
router.get("/:chamaId", protect, getChamaMeetings);
router.get("/:chamaId/:id", protect, getMeetingById);
router.put(
  "/:chamaId/:id",
  protect,
  isOfficial,
  validate(updateMeetingSchema),
  updateMeeting
);
router.post("/:chamaId/:id/attendance", protect, isOfficial, recordAttendance);

module.exports = router;
