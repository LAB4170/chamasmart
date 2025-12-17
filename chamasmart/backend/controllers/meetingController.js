const pool = require("../config/db");

// @desc    Create meeting
// @route   POST /api/meetings/:chamaId/create
// @access  Private (Officials only)
const createMeeting = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const { meetingDate, meetingTime, location, agenda } = req.body;

    if (!meetingDate) {
      return res.status(400).json({
        success: false,
        message: "Meeting date is required",
      });
    }

    const result = await pool.query(
      `INSERT INTO meetings (chama_id, meeting_date, meeting_time, location, agenda, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [chamaId, meetingDate, meetingTime, location, agenda, req.user.user_id]
    );

    res.status(201).json({
      success: true,
      message: "Meeting created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create meeting error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating meeting",
      error: error.message,
    });
  }
};

// @desc    Get all meetings for a chama
// @route   GET /api/meetings/:chamaId
// @access  Private
const getChamaMeetings = async (req, res) => {
  try {
    const { chamaId } = req.params;

    const result = await pool.query(
      `SELECT m.*, u.first_name || ' ' || u.last_name as recorded_by_name,
              (SELECT COUNT(*) FROM meeting_attendance WHERE meeting_id = m.meeting_id AND attended = true) as attendees_count
       FROM meetings m
       LEFT JOIN users u ON m.recorded_by = u.user_id
       WHERE m.chama_id = $1
       ORDER BY m.meeting_date DESC, m.created_at DESC`,
      [chamaId]
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get meetings error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching meetings",
    });
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
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    // Get attendance
    const attendanceResult = await pool.query(
      `SELECT ma.*, u.first_name, u.last_name, u.email
       FROM meeting_attendance ma
       INNER JOIN users u ON ma.user_id = u.user_id
       WHERE ma.meeting_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        meeting: meetingResult.rows[0],
        attendance: attendanceResult.rows,
      },
    });
  } catch (error) {
    console.error("Get meeting error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching meeting",
    });
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
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
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
      return res.status(404).json({
        success: false,
        message: "Meeting not found",
      });
    }

    res.json({
      success: true,
      message: "Meeting updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update meeting error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating meeting",
    });
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
      return res.status(400).json({
        success: false,
        message: "Attendance array is required",
      });
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

    res.json({
      success: true,
      message: "Attendance recorded successfully",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Record attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Error recording attendance",
      error: error.message,
    });
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
