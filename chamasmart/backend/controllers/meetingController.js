/**
 * Production-Grade Meeting Controller
 * Fixes: SQL injection, authorization, validation
 */

const pool = require("../config/db");
const { AppError } = require("../middleware/errorHandler");
const logger = require("../utils/logger");
const { body, param, validationResult } = require("express-validator");
const {
  parsePagination,
  buildLimitClause,
  getTotal,
} = require("../utils/pagination");

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

const createMeetingValidation = [
  param("chamaId").isInt({ min: 1 }).withMessage("Invalid chama ID"),
  body("meetingDate")
    .notEmpty()
    .withMessage("Meeting date is required")
    .isISO8601()
    .withMessage("Invalid date format")
    .toDate(),
  body("meetingTime")
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("Invalid time format (HH:MM)"),
  body("location")
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage("Location too long")
    .escape(),
  body("agenda")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Agenda too long"),
];

const updateMeetingValidation = [
  param("chamaId").isInt({ min: 1 }).withMessage("Invalid chama ID"),
  param("id").isInt({ min: 1 }).withMessage("Invalid meeting ID"),
  body("meetingDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format")
    .toDate(),
  body("meetingTime")
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("Invalid time format (HH:MM)"),
  body("location")
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage("Location too long")
    .escape(),
  body("agenda")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Agenda too long"),
  body("minutes")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Minutes too long"),
  body("totalCollected")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Invalid total collected amount")
    .toFloat(),
];

// ============================================================================
// AUTHORIZATION HELPER
// ============================================================================

async function checkChamaOfficial(chamaId, userId) {
  const result = await pool.query(
    `SELECT role FROM chama_members 
     WHERE chama_id = $1 AND user_id = $2 AND is_active = true`,
    [chamaId, userId],
  );

  if (result.rows.length === 0) {
    throw new AppError("Not a member of this chama", 403, "NOT_MEMBER");
  }

  if (
    !["CHAIRPERSON", "SECRETARY", "TREASURER"].includes(result.rows[0].role)
  ) {
    throw new AppError(
      "Insufficient permissions. Only officials can manage meetings.",
      403,
      "NOT_OFFICIAL",
    );
  }

  return result.rows[0].role;
}

async function checkChamaMember(chamaId, userId) {
  const result = await pool.query(
    `SELECT 1 FROM chama_members 
     WHERE chama_id = $1 AND user_id = $2 AND is_active = true`,
    [chamaId, userId],
  );

  if (result.rows.length === 0) {
    throw new AppError("Not a member of this chama", 403, "NOT_MEMBER");
  }
}

// ============================================================================
// CREATE MEETING
// ============================================================================

const createMeeting = async (req, res, next) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  try {
    const { chamaId } = req.params;
    const { meetingDate, meetingTime, location, agenda } = req.body;

    // Check authorization
    await checkChamaOfficial(chamaId, req.user.user_id);

    // Verify chama exists
    const chamaCheck = await pool.query(
      "SELECT chama_id FROM chamas WHERE chama_id = $1 AND is_active = true",
      [chamaId],
    );

    if (chamaCheck.rows.length === 0) {
      throw new AppError("Chama not found or inactive", 404, "CHAMA_NOT_FOUND");
    }

    // Create meeting
    const result = await pool.query(
      `INSERT INTO meetings 
       (chama_id, scheduled_date, location, description, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        chamaId,
        meetingDate,
        location || null,
        agenda || null,
        req.user.user_id,
      ],
    );

    logger.info("Meeting created", {
      meetingId: result.rows[0].meeting_id,
      chamaId,
      meetingDate,
      by: req.user.user_id,
    });

    res.status(201).json({
      success: true,
      message: "Meeting created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// GET CHAMA MEETINGS
// ============================================================================

const getChamaMeetings = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const { page = 1, limit = 20, upcoming, past } = req.query;

    // Check authorization (must be member)
    await checkChamaMember(chamaId, req.user.user_id);

    // Parse pagination
    const { page: pageNum, limit: limitNum } = parsePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;

    // Build query
    let whereClause = "WHERE m.chama_id = $1";
    const params = [chamaId];

    if (upcoming === "true") {
      whereClause += " AND m.scheduled_date >= CURRENT_DATE";
    } else if (past === "true") {
      whereClause += " AND m.scheduled_date < CURRENT_DATE";
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM meetings m ${whereClause}`;
    const totalCount = await getTotal(countQuery, params, "count");

    // Get meetings
    const query = `
      SELECT m.*, 
             u.first_name || ' ' || u.last_name as created_by_name,
             (SELECT COUNT(*) FROM meeting_attendance 
              WHERE meeting_id = m.meeting_id AND attended = true) as attendees_count
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.user_id
      ${whereClause}
      ORDER BY m.scheduled_date DESC, m.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limitNum, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      message: "Meetings retrieved successfully",
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// GET MEETING BY ID
// ============================================================================

const getMeetingById = async (req, res, next) => {
  try {
    const { chamaId, id } = req.params;

    // Check authorization
    await checkChamaMember(chamaId, req.user.user_id);

    // Get meeting details
    const meetingResult = await pool.query(
      `SELECT m.*, u.first_name || ' ' || u.last_name as created_by_name
       FROM meetings m
       LEFT JOIN users u ON m.created_by = u.user_id
       WHERE m.chama_id = $1 AND m.meeting_id = $2`,
      [chamaId, id],
    );

    if (meetingResult.rows.length === 0) {
      throw new AppError("Meeting not found", 404, "MEETING_NOT_FOUND");
    }

    // Get attendance
    const attendanceResult = await pool.query(
      `SELECT ma.*, u.first_name, u.last_name, u.email,
              cm.role
       FROM meeting_attendance ma
       INNER JOIN users u ON ma.user_id = u.user_id
       LEFT JOIN chama_members cm ON cm.user_id = ma.user_id AND cm.chama_id = $1
       WHERE ma.meeting_id = $2
       ORDER BY cm.role, u.last_name, u.first_name`,
      [chamaId, id],
    );

    res.json({
      success: true,
      message: "Meeting retrieved successfully",
      data: {
        meeting: meetingResult.rows[0],
        attendance: attendanceResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// UPDATE MEETING
// ============================================================================

const updateMeeting = async (req, res, next) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  try {
    const { chamaId, id } = req.params;

    // Check authorization
    await checkChamaOfficial(chamaId, req.user.user_id);

    // Build update query safely
    const allowedFields = {
      meetingDate: "scheduled_date",
      location: "location",
      description: "description",
      minutes: "minutes",
      status: "status",
    };

    const updates = [];
    const values = [];
    let paramCount = 1;

    Object.keys(req.body).forEach((key) => {
      if (allowedFields[key] && req.body[key] !== undefined) {
        updates.push(`${allowedFields[key]} = $${paramCount}`);
        values.push(req.body[key]);
        paramCount++;
      }
    });

    if (updates.length === 0) {
      throw new AppError("No valid fields to update", 400, "NO_FIELDS");
    }

    values.push(chamaId, id);

    const query = `
      UPDATE meetings 
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE chama_id = $${paramCount} AND meeting_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new AppError("Meeting not found", 404, "MEETING_NOT_FOUND");
    }

    logger.info("Meeting updated", {
      meetingId: id,
      chamaId,
      updates: Object.keys(req.body),
      by: req.user.user_id,
    });

    res.json({
      success: true,
      message: "Meeting updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// RECORD ATTENDANCE
// ============================================================================

const recordAttendance = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { chamaId, id } = req.params;
    const { attendance } = req.body; // Array of { userId, attended, late, notes }

    // Validate input
    if (!Array.isArray(attendance) || attendance.length === 0) {
      throw new AppError("Attendance array is required", 400, "INVALID_INPUT");
    }

    // Check authorization
    await checkChamaOfficial(chamaId, req.user.user_id);

    await client.query("BEGIN");

    // Verify meeting exists
    const meetingCheck = await client.query(
      "SELECT meeting_id FROM meetings WHERE chama_id = $1 AND meeting_id = $2",
      [chamaId, id],
    );

    if (meetingCheck.rows.length === 0) {
      throw new AppError("Meeting not found", 404, "MEETING_NOT_FOUND");
    }

    // Delete existing attendance records
    await client.query("DELETE FROM meeting_attendance WHERE meeting_id = $1", [
      id,
    ]);

    // Bulk insert new attendance records
    if (attendance.length > 0) {
      const values = [];
      const placeholders = [];

      attendance.forEach((record, index) => {
        const baseIndex = index * 5;
        placeholders.push(
          `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`,
        );
        values.push(
          id,
          record.userId,
          record.attended || false,
          record.late || false,
          record.notes || null,
        );
      });

      const insertQuery = `
        INSERT INTO meeting_attendance 
        (meeting_id, user_id, attended, late, notes)
        VALUES ${placeholders.join(", ")}
      `;

      await client.query(insertQuery, values);
    }

    await client.query("COMMIT");

    logger.info("Attendance recorded", {
      meetingId: id,
      chamaId,
      recordCount: attendance.length,
      by: req.user.user_id,
    });

    res.json({
      success: true,
      message: "Attendance recorded successfully",
      data: {
        meetingId: id,
        recordsCount: attendance.length,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
};

// ============================================================================
// DELETE MEETING
// ============================================================================

const deleteMeeting = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { chamaId, id } = req.params;

    // Check authorization (only CHAIRPERSON can delete)
    const role = await checkChamaOfficial(chamaId, req.user.user_id);
    if (role !== "CHAIRPERSON") {
      throw new AppError(
        "Only chairperson can delete meetings",
        403,
        "CHAIRPERSON_ONLY",
      );
    }

    await client.query("BEGIN");

    // Delete attendance records first
    await client.query("DELETE FROM meeting_attendance WHERE meeting_id = $1", [
      id,
    ]);

    // Delete meeting
    const result = await client.query(
      "DELETE FROM meetings WHERE chama_id = $1 AND meeting_id = $2 RETURNING *",
      [chamaId, id],
    );

    if (result.rows.length === 0) {
      throw new AppError("Meeting not found", 404, "MEETING_NOT_FOUND");
    }

    await client.query("COMMIT");

    logger.info("Meeting deleted", {
      meetingId: id,
      chamaId,
      by: req.user.user_id,
    });

    res.json({
      success: true,
      message: "Meeting deleted successfully",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  createMeeting: [createMeetingValidation, createMeeting],
  getChamaMeetings,
  getMeetingById,
  updateMeeting: [updateMeetingValidation, updateMeeting],
  recordAttendance,
  deleteMeeting,
};
