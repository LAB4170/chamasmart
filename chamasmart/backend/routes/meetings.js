const express = require('express');

const router = express.Router();
const {
  createMeeting,
  getChamaMeetings,
  getMeetingById,
  updateMeeting,
  recordAttendance,
} = require('../controllers/meetingController');
const { protect, authorize } = require('../middleware/auth');
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

// Create new meeting (officials only)
router.post(
  '/:chamaId',
  authorize('ADMIN', 'TREASURER', 'CHAIRPERSON'),
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

// Update meeting details (officials only)
router.put(
  '/:chamaId/:meetingId',
  authorize('ADMIN', 'TREASURER', 'CHAIRPERSON'),
  validate(updateMeetingSchema),
  updateMeeting,
);

// Record attendance for a meeting (officials only)
router.post(
  '/:chamaId/:meetingId/attendance',
  authorize('ADMIN', 'TREASURER', 'CHAIRPERSON'),
  validate(recordAttendanceSchema),
  recordAttendance,
);

module.exports = router;
