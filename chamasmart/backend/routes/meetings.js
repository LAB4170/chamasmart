const express = require("express");
const router = express.Router();
const {
  createMeeting,
  getChamaMeetings,
  getMeetingById,
  updateMeeting,
  recordAttendance,
} = require("../controllers/meetingController");
const { protect, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");
const {
  createMeetingSchema,
  updateMeetingSchema,
  recordAttendanceSchema,
} = require("../utils/validationSchemas");
const { applyRateLimiting } = require("../middleware/rateLimiting");

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// MEETING MANAGEMENT (Officials can create/update/delete)
// ============================================================================

// Create new meeting (officials only)
router.post(
  "/:chamaId",
  authorize("admin", "treasurer", "chairperson"),
  applyRateLimiting,
  validate(createMeetingSchema),
  createMeeting,
);

// Get all meetings for a chama (all members can view)
router.get(
  "/:chamaId",
  authorize("member", "admin", "treasurer", "chairperson"),
  getChamaMeetings,
);

// Get specific meeting by ID
router.get(
  "/:chamaId/:meetingId",
  authorize("member", "admin", "treasurer", "chairperson"),
  getMeetingById,
);

// Update meeting details (officials only)
router.put(
  "/:chamaId/:meetingId",
  authorize("admin", "treasurer", "chairperson"),
  validate(updateMeetingSchema),
  updateMeeting,
);

// Record attendance for a meeting (officials only)
router.post(
  "/:chamaId/:meetingId/attendance",
  authorize("admin", "treasurer", "chairperson"),
  validate(recordAttendanceSchema),
  recordAttendance,
);

module.exports = router;
