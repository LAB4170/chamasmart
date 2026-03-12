const express = require('express');

const router = express.Router();
const {
  createMeeting,
  getChamaMeetings,
  getMeetingById,
  updateMeeting,
  recordAttendance,
  deleteMeeting,
  publishMinutes,
} = require('../controllers/meetingController');
const { protect, authorize, isSecretary, isTreasurer, isOfficial } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createMeetingSchema,
  updateMeetingSchema,
  recordAttendanceSchema,
} = require('../utils/validationSchemas');
const { applyRateLimiting } = require('../middleware/rateLimiting');

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// MEETING MANAGEMENT (Officials can create/update/delete)
// ============================================================================

// Create new meeting (Secretaries & Chairs only)
router.post(
  '/:chamaId',
  isSecretary,
  applyRateLimiting,
  validate(createMeetingSchema),
  createMeeting,
);

// Get all meetings for a chama (all members can view)
router.get(
  '/:chamaId',
  authorize('MEMBER', 'ADMIN', 'TREASURER', 'CHAIRPERSON'),
  getChamaMeetings,
);

// Get specific meeting by ID
router.get(
  '/:chamaId/:meetingId',
  authorize('MEMBER', 'ADMIN', 'TREASURER', 'CHAIRPERSON'),
  getMeetingById,
);

// Update meeting details (Secretaries & Chairs only)
router.put(
  '/:chamaId/:meetingId',
  isSecretary,
  validate(updateMeetingSchema),
  updateMeeting,
);

// Record attendance for a meeting (Secretaries & Chairs only)
router.post(
  '/:chamaId/:meetingId/attendance',
  isSecretary,
  validate(recordAttendanceSchema),
  recordAttendance,
);

// Publish meeting minutes (Secretaries & Chairs only)
router.post(
  '/:chamaId/:meetingId/publish',
  isSecretary,
  publishMinutes,
);

// Delete meeting (chairperson only)
router.delete(
  '/:chamaId/:meetingId',
  authorize('CHAIRPERSON'),
  deleteMeeting,
);

module.exports = router;
