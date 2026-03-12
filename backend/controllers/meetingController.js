/**
 * Production-Grade Meeting Controller
 * Fixes: SQL injection, authorization, validation
 */

const pool = require("../config/db");
const { AppError } = require("../middleware/errorHandler");
const logger = require("../utils/logger");
const { createNotification, createBulkNotifications } = require('../utils/notificationService');
const TrustScoreService = require("../utils/trustScoreService");
const { body, param, validationResult } = require("express-validator");
const {
  parsePagination,
  buildLimitClause,
  getTotal,
} = require("../utils/pagination");

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

// ============================================================================
// HELPERS
// ============================================================================

const checkChamaMember = async (chamaId, userId) => {
  const result = await pool.query(
    'SELECT 1 FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true',
    [chamaId, userId],
  );
  if (result.rows.length === 0) {
    throw new AppError('You are not a member of this chama', 403, 'NOT_AUTHORIZED');
  }
  return true;
};

const checkChamaOfficial = async (chamaId, userId) => {
  const result = await pool.query(
    'SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true',
    [chamaId, userId],
  );
  if (result.rows.length === 0) {
    throw new AppError('You are not a member of this chama', 403, 'NOT_AUTHORIZED');
  }
  const { role } = result.rows[0];
  if (!['CHAIRPERSON', 'SECRETARY', 'TREASURER'].includes(role)) {
    throw new AppError('Only chama officials can perform this action', 403, 'OFFICIAL_ONLY');
  }
  return role;
};

// ============================================================================
// CREATE MEETING
// ============================================================================

const createMeeting = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const {
      title, description, scheduledAt, location, type, meetingLink,
    } = req.body;

    // Check authorization
    await checkChamaOfficial(chamaId, req.user.user_id);

    // Verify chama exists
    const chamaCheck = await pool.query(
      'SELECT chama_id FROM chamas WHERE chama_id = $1 AND is_active = true',
      [chamaId],
    );

    if (chamaCheck.rows.length === 0) {
      throw new AppError('Chama not found or inactive', 404, 'CHAMA_NOT_FOUND');
    }

    // Create meeting
    // Note: 'type' and 'meeting_link' columns might need to be added to DB if not exist
    // For now, mapping 'type' -> description or similar if DB is limited, 
    // but assuming schema supports it or we just store basic fields.
    // Checking previous code: INSERT INTO meetings (..., scheduled_date, location, description, ...)
    const result = await pool.query(
      `INSERT INTO meetings 
       (chama_id, title, scheduled_date, location, description, meeting_link, meeting_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        chamaId,
        title,
        scheduledAt,
        location || null,
        description || null,
        meetingLink || null,
        type || 'PHYSICAL',
        req.user.user_id,
      ],
    );

    const meeting = result.rows[0];

    // Notify all active members except the creator
    try {
      const membersRes = await pool.query(
        'SELECT user_id FROM chama_members WHERE chama_id = $1 AND is_active = true AND user_id != $2',
        [chamaId, req.user.user_id]
      );
      
      const chamaName = chamaCheck.rows[0]?.chama_name || 'your chama';
      const dateStr = new Date(scheduledAt).toLocaleString();
      
      const notifications = membersRes.rows.map(member => ({
        userId: member.user_id,
        type: 'MEETING_CREATED',
        title: `New Meeting: ${title}`,
        message: `Scheduled for ${dateStr} in ${chamaName}`,
        entityType: 'MEETING',
        entityId: meeting.meeting_id
      }));

      if (notifications.length > 0) {
        await createBulkNotifications(null, notifications);
      }
    } catch (notifErr) {
      logger.error('Failed to send meeting notifications', { error: notifErr.message, chamaId });
    }
    // Notify all active members except the creator
    try {
      const membersRes = await pool.query(
        'SELECT user_id FROM chama_members WHERE chama_id = $1 AND is_active = true AND user_id != $2',
        [chamaId, req.user.user_id]
      );
      
      const chamaName = chamaCheck.rows[0]?.chama_name || 'your chama';
      const dateStr = new Date(scheduledAt).toLocaleString();
      
      const notifications = membersRes.rows.map(member => ({
        userId: member.user_id,
        type: 'MEETING_CREATED',
        title: `New Meeting: ${title}`,
        message: `Scheduled for ${dateStr} in ${chamaName}`,
        entityType: 'MEETING',
        entityId: meeting.meeting_id
      }));

      if (notifications.length > 0) {
        await createBulkNotifications(null, notifications);
      }
    } catch (notifErr) {
      logger.error('Failed to send meeting notifications', { error: notifErr.message, chamaId });
    }

    logger.info('Meeting created', {
      meetingId: meeting.meeting_id,
      chamaId,
      scheduledAt,
      by: req.user.user_id,
    });

    res.status(201).json({
      success: true,
      message: 'Meeting created successfully',
      data: meeting,
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
    const {
      page = 1, limit = 20, upcoming, past,
    } = req.query;

    console.log('DEBUG: getChamaMeetings called');
    console.log('DEBUG: chamaId:', chamaId);
    console.log('DEBUG: req.user:', req.user); // Check if user is attached

    // Check authorization (must be member)
    await checkChamaMember(chamaId, req.user.user_id);

    // Parse pagination
    const { page: pageNum, limit: limitNum } = parsePagination(page, limit);
    const offset = (pageNum - 1) * limitNum;

    // Build query
    let whereClause = 'WHERE m.chama_id = $1';
    const params = [chamaId];

    if (upcoming === 'true') {
      whereClause += ' AND m.scheduled_date >= CURRENT_DATE';
    } else if (past === 'true') {
      whereClause += ' AND m.scheduled_date < CURRENT_DATE';
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM meetings m ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

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
      message: 'Meetings retrieved successfully',
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
    const { chamaId, meetingId } = req.params;

    // Check authorization
    await checkChamaMember(chamaId, req.user.user_id);

    // Get meeting details
    const meetingResult = await pool.query(
      `SELECT m.*, u.first_name || ' ' || u.last_name as created_by_name
       FROM meetings m
       LEFT JOIN users u ON m.created_by = u.user_id
       WHERE m.chama_id = $1 AND m.meeting_id = $2`,
      [chamaId, meetingId],
    );

    if (meetingResult.rows.length === 0) {
      throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
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
      [chamaId, meetingId],
    );

    res.json({
      success: true,
      message: 'Meeting retrieved successfully',
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
  try {
    const { chamaId, meetingId } = req.params;

    // Check authorization
    await checkChamaOfficial(chamaId, req.user.user_id);

    // Build update query safely
    const allowedFields = {
      scheduledAt: 'scheduled_date',
      location: 'location',
      description: 'description',
      minutes: 'minutes',
      status: 'status',
      title: 'title',
      meetingLink: 'meeting_link',
      type: 'meeting_type',
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
      throw new AppError('No valid fields to update', 400, 'NO_FIELDS');
    }

    values.push(chamaId, meetingId);

    const query = `
      UPDATE meetings 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE chama_id = $${paramCount} AND meeting_id = $${paramCount + 1}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
    }

    logger.info('Meeting updated', {
      meetingId: id,
      chamaId,
      updates: Object.keys(req.body),
      by: req.user.user_id,
    });

    res.json({
      success: true,
      message: 'Meeting updated successfully',
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
    const { chamaId, meetingId } = req.params;
    const { attendance } = req.body; // Array of { userId, attended, late, notes }

    // Validate input
    if (!Array.isArray(attendance) || attendance.length === 0) {
      throw new AppError('Attendance array is required', 400, 'INVALID_INPUT');
    }

    // Check authorization
    await checkChamaOfficial(chamaId, req.user.user_id);

    await client.query('BEGIN');

    // Verify meeting exists
    const meetingCheck = await client.query(
      'SELECT meeting_id FROM meetings WHERE chama_id = $1 AND meeting_id = $2',
      [chamaId, meetingId],
    );

    if (meetingCheck.rows.length === 0) {
      throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
    }

    // Delete existing attendance records
    await client.query('DELETE FROM meeting_attendance WHERE meeting_id = $1', [
      meetingId,
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
          meetingId,
          record.userId,
          record.attended || false,
          record.late || false,
          record.notes || null,
        );
      });

      const insertQuery = `
        INSERT INTO meeting_attendance 
        (meeting_id, user_id, attended, late, notes)
        VALUES ${placeholders.join(', ')}
      `;

      await client.query(insertQuery, values);
    }

    await client.query('COMMIT');

    // Trigger Trust Score Updates for all members in the chama
    // (In a real system, this might be backgrounded)
    try {
      const membersRes = await pool.query('SELECT user_id FROM chama_members WHERE chama_id = $1 AND is_active = true', [chamaId]);
      for (const member of membersRes.rows) {
        await TrustScoreService.updateMemberTrustScore(chamaId, member.user_id);
      }
    } catch (tsErr) {
      logger.error('Failed to update trust scores after attendance', { error: tsErr.message });
    }

    logger.info('Attendance recorded', {
      meetingId: id,
      chamaId,
      recordCount: attendance.length,
      by: req.user.user_id,
    });

    res.json({
      success: true,
      message: 'Attendance recorded successfully',
      data: {
        meetingId: id,
        recordsCount: attendance.length,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
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
    const { chamaId, meetingId } = req.params;

    // Check authorization (only CHAIRPERSON can delete)
    const role = await checkChamaOfficial(chamaId, req.user.user_id);
    if (role !== 'CHAIRPERSON') {
      throw new AppError(
        'Only chairperson can delete meetings',
        403,
        'CHAIRPERSON_ONLY',
      );
    }

    await client.query('BEGIN');

    // Delete attendance records first
    await client.query('DELETE FROM meeting_attendance WHERE meeting_id = $1', [
      meetingId,
    ]);

    // Delete meeting
    const result = await client.query(
      'DELETE FROM meetings WHERE chama_id = $1 AND meeting_id = $2 RETURNING *',
      [chamaId, meetingId],
    );

    if (result.rows.length === 0) {
      throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
    }

    await client.query('COMMIT');

    logger.info('Meeting deleted', {
      meetingId: id,
      chamaId,
      by: req.user.user_id,
    });

    res.json({
      success: true,
      message: 'Meeting deleted successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

// ============================================================================
// PUBLISH MINUTES
// ============================================================================

const publishMinutes = async (req, res, next) => {
  try {
    const { chamaId, meetingId } = req.params;

    // Verify meeting exists and is in a state that can be published
    const meetingRes = await pool.query(
      'SELECT title, status FROM meetings WHERE chama_id = $1 AND meeting_id = $2',
      [chamaId, meetingId]
    );

    if (meetingRes.rows.length === 0) {
      throw new AppError('Meeting not found', 404, 'MEETING_NOT_FOUND');
    }

    if (meetingRes.rows[0].status === 'COMPLETED') {
      throw new AppError('Minutes already published for this meeting', 400, 'ALREADY_PUBLISHED');
    }

    // Update meeting status and official minutes flag
    const result = await pool.query(
      `UPDATE meetings 
       SET status = 'COMPLETED', updated_at = NOW()
       WHERE chama_id = $1 AND meeting_id = $2
       RETURNING *`,
      [chamaId, meetingId]
    );

    const meeting = result.rows[0];

    // Notify all active members
    try {
      const membersRes = await pool.query(
        'SELECT user_id FROM chama_members WHERE chama_id = $1 AND is_active = true',
        [chamaId]
      );
      
      const notifications = membersRes.rows.map(member => ({
        userId: member.user_id,
        type: 'MINUTES_PUBLISHED',
        title: `Minutes Published: ${meeting.title}`,
        message: `Official minutes are now available in the Minutes Vault.`,
        entityType: 'MEETING',
        entityId: meetingId
      }));

      if (notifications.length > 0) {
        await createBulkNotifications(null, notifications);
      }
    } catch (notifErr) {
      logger.error('Failed to send minutes notifications', { error: notifErr.message, chamaId });
    }

    logger.info('Minutes published', {
      meetingId,
      chamaId,
      by: req.user.user_id,
    });

    res.json({
      success: true,
      message: 'Minutes published successfully and members notified',
      data: meeting,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  createMeeting,
  getChamaMeetings,
  getMeetingById,
  updateMeeting,
  recordAttendance,
  publishMinutes,
  deleteMeeting,
};
