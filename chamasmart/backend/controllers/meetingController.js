const pool = require("../config/db");
const {
  parsePagination,
  buildLimitClause,
  getTotal,
} = require("../utils/pagination");

// @desc    Create meeting
// @route   POST /api/meetings/:chamaId/create
// @access  Private (Officials only)
const createMeeting = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const { meetingDate, meetingTime, location, agenda } = req.body;

    if (!meetingDate) {
      return res.validationError([
        { field: "meetingDate", message: "Meeting date is required" },
      ]);
    }

    const result = await pool.query(
      `INSERT INTO meetings (chama_id, meeting_date, meeting_time, location, agenda, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [chamaId, meetingDate, meetingTime, location, agenda, req.user.user_id]
    );

    return res.success(result.rows[0], "Meeting created successfully", 201);
  } catch (error) {
    console.error("Create meeting error:", error);
    return res.error("Error creating meeting", 500);
  }
};

// @desc    Get all meetings for a chama
// @route   GET /api/meetings/:chamaId
// @access  Private
const getChamaMeetings = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const { page, limit } = req.query;

    // Parse pagination
    const { page: pageNum, limit: limitNum } = parsePagination(page, limit);

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM meetings WHERE chama_id = $1`;
    const totalCount = await getTotal(countQuery, [chamaId], "count");

    const result = await pool.query(
      `SELECT m.*, u.first_name || ' ' || u.last_name as recorded_by_name,
              (SELECT COUNT(*) FROM meeting_attendance WHERE meeting_id = m.meeting_id AND attended = true) as attendees_count
       FROM meetings m
       LEFT JOIN users u ON m.recorded_by = u.user_id
       WHERE m.chama_id = $1
       ORDER BY m.meeting_date DESC, m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [chamaId, limitNum, (pageNum - 1) * limitNum]
    );

    return res.paginated(
      result.rows,
      totalCount,
      pageNum,
      limitNum,
      "Meetings retrieved successfully"
    );
  } catch (error) {
    console.error("Get meetings error:", error);
    return res.error("Error fetching meetings", 500);
  }
};

// @desc    Get single meeting with attendance
// @route   GET /api/meetings/:chamaId/:id
// @access  Private
const getMeetingById = async (req, res) => {
  try {
    const { chamaId, id } = req.params;

    // Get meeting details
    const meetingResult = await pool.query(
      `SELECT m.*, u.first_name || ' ' || u.last_name as recorded_by_name
       FROM meetings m
       LEFT JOIN users u ON m.recorded_by = u.user_id
       WHERE m.chama_id = $1 AND m.meeting_id = $2`,
      [chamaId, id]
    );

    if (meetingResult.rows.length === 0) {
      return res.error("Meeting not found", 404);
    }

    // Get attendance
    const attendanceResult = await pool.query(
      `SELECT ma.*, u.first_name, u.last_name, u.email
       FROM meeting_attendance ma
       INNER JOIN users u ON ma.user_id = u.user_id
       WHERE ma.meeting_id = $1`,
      [id]
    );

    return res.success(
      {
        meeting: meetingResult.rows[0],
        attendance: attendanceResult.rows,
      },
      "Meeting retrieved successfully"
    );
  } catch (error) {
    console.error("Get meeting error:", error);
    return res.error("Error fetching meeting", 500);
  }
};

// @desc    Update meeting
// @route   PUT /api/meetings/:chamaId/:id
// @access  Private (Officials only)
const updateMeeting = async (req, res) => {
  try {
    const { chamaId, id } = req.params;
    const {
      meetingDate,
      meetingTime,
      location,
      agenda,
      minutes,
      totalCollected,
    } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (meetingDate) {
      updates.push(`meeting_date = $${paramCount++}`);
      values.push(meetingDate);
    }
    if (meetingTime !== undefined) {
      updates.push(`meeting_time = $${paramCount++}`);
      values.push(meetingTime);
    }
    if (location !== undefined) {
      updates.push(`location = $${paramCount++}`);
      values.push(location);
    }
    if (agenda !== undefined) {
      updates.push(`agenda = $${paramCount++}`);
      values.push(agenda);
    }
    if (minutes !== undefined) {
      updates.push(`minutes = $${paramCount++}`);
      values.push(minutes);
    }
    if (totalCollected !== undefined) {
      updates.push(`total_collected = $${paramCount++}`);
      values.push(totalCollected);
    }

    if (updates.length === 0) {
      return res.validationError([
        { field: "body", message: "No fields to update" },
      ]);
    }

    values.push(chamaId, id);

    const query = `
      UPDATE meetings 
      SET ${updates.join(", ")}
      WHERE chama_id = $${paramCount++} AND meeting_id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.error("Meeting not found", 404);
    }

    return res.success(result.rows[0], "Meeting updated successfully");
  } catch (error) {
    console.error("Update meeting error:", error);
    return res.error("Error updating meeting", 500);
  }
};

// @desc    Record attendance for meeting
// @route   POST /api/meetings/:chamaId/:id/attendance
// @access  Private (Officials only)
const recordAttendance = async (req, res) => {
  const client = await pool.connect();

  try {
    const { chamaId, id } = req.params;
    const { attendance } = req.body; // Array of { userId, attended, late, notes }

    if (!Array.isArray(attendance) || attendance.length === 0) {
      return res.validationError([
        { field: "attendance", message: "Attendance array is required" },
      ]);
    }

    await client.query("BEGIN");

    // Delete existing attendance records for this meeting
    await client.query("DELETE FROM meeting_attendance WHERE meeting_id = $1", [
      id,
    ]);

    // Insert new attendance records
    for (const record of attendance) {
      await client.query(
        `INSERT INTO meeting_attendance (meeting_id, user_id, attended, late, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          id,
          record.userId,
          record.attended || false,
          record.late || false,
          record.notes || null,
        ]
      );
    }

    await client.query("COMMIT");

    return res.success(null, "Attendance recorded successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Record attendance error:", error);
    return res.error("Error recording attendance", 500);
  } finally {
    client.release();
  }
};

module.exports = {
  createMeeting,
  getChamaMeetings,
  getMeetingById,
  updateMeeting,
  recordAttendance,
};
