const pool = require("../config/db");

// @desc    Request to join a public chama
// @route   POST /api/join-requests/:chamaId/request
// @access  Private
const requestToJoin = async (req, res) => {
  const client = await pool.connect();

  try {
    const { chamaId } = req.params;
    const { message } = req.body;
    const userId = req.user.user_id;

    await client.query("BEGIN");

    // Check if chama exists and is public
    const chamaResult = await client.query(
      "SELECT * FROM chamas WHERE chama_id = $1",
      [chamaId]
    );

    if (chamaResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Chama not found",
      });
    }

    const chama = chamaResult.rows[0];

    if (chama.visibility !== "PUBLIC") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "This chama is private. Please use an invite code to join.",
      });
    }

    // Check if user is already a member
    const memberCheck = await client.query(
      "SELECT * FROM chama_members WHERE chama_id = $1 AND user_id = $2",
      [chamaId, userId]
    );

    if (memberCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "You are already a member of this chama",
      });
    }

    // Check for existing pending request
    const existingRequest = await client.query(
      "SELECT * FROM join_requests WHERE chama_id = $1 AND user_id = $2 AND status = 'PENDING'",
      [chamaId, userId]
    );

    if (existingRequest.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "You already have a pending request for this chama",
      });
    }

    // Create join request
    const requestResult = await client.query(
      `INSERT INTO join_requests (chama_id, user_id, message, status)
       VALUES ($1, $2, $3, 'PENDING')
       RETURNING *`,
      [chamaId, userId, message]
    );

    const joinRequest = requestResult.rows[0];

    // Get chama officials to notify
    const officialsResult = await client.query(
      `SELECT user_id FROM chama_members 
       WHERE chama_id = $1 AND role IN ('CHAIRPERSON', 'SECRETARY', 'TREASURER') AND is_active = true`,
      [chamaId]
    );

    // Create notifications for all officials
    const { createNotification } = require("../utils/notifications");
    const userResult = await client.query(
      "SELECT first_name, last_name FROM users WHERE user_id = $1",
      [userId]
    );
    const requester = userResult.rows[0];

    for (const official of officialsResult.rows) {
      await createNotification({
        userId: official.user_id,
        type: "JOIN_REQUEST",
        title: "New Join Request",
        message: `${requester.first_name} ${requester.last_name} wants to join ${chama.chama_name}`,
        link: `/chamas/${chamaId}/join-requests`,
        relatedId: joinRequest.request_id,
      });
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Join request submitted successfully",
      data: joinRequest,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Request to join error:", error);
    res.status(500).json({
      success: false,
      message: "Error submitting join request",
    });
  } finally {
    client.release();
  }
};

// @desc    Get join requests for a chama
// @route   GET /api/join-requests/:chamaId
// @access  Private (Officials only)
const getJoinRequests = async (req, res) => {
  try {
    const { chamaId } = req.params;

    const result = await pool.query(
      `SELECT jr.*, u.first_name, u.last_name, u.email, u.phone_number,
              r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
       FROM join_requests jr
       JOIN users u ON jr.user_id = u.user_id
       LEFT JOIN users r ON jr.reviewed_by = r.user_id
       WHERE jr.chama_id = $1
       ORDER BY 
         CASE jr.status 
           WHEN 'PENDING' THEN 1 
           WHEN 'APPROVED' THEN 2 
           WHEN 'REJECTED' THEN 3 
         END,
         jr.created_at DESC`,
      [chamaId]
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get join requests error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching join requests",
    });
  }
};

// @desc    Respond to join request (approve/reject)
// @route   PUT /api/join-requests/:requestId/respond
// @access  Private (Officials only)
const respondToRequest = async (req, res) => {
  const client = await pool.connect();

  try {
    const { requestId } = req.params;
    const { status } = req.body; // 'APPROVED' or 'REJECTED'
    const reviewerId = req.user.user_id;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be APPROVED or REJECTED",
      });
    }

    await client.query("BEGIN");

    // Get join request
    const requestResult = await client.query(
      "SELECT * FROM join_requests WHERE request_id = $1",
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Join request not found",
      });
    }

    const joinRequest = requestResult.rows[0];

    // CRITICAL FIX: Verify reviewer is an official in this chama
    const officialCheck = await client.query(
      `SELECT * FROM chama_members 
             WHERE chama_id = $1 
             AND user_id = $2 
             AND role IN ('CHAIRPERSON', 'SECRETARY', 'TREASURER', 'official')
             AND is_active = true`,
      [joinRequest.chama_id, reviewerId]
    );

    if (officialCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to respond to join requests for this chama",
      });
    }

    if (joinRequest.status !== "PENDING") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "This request has already been reviewed",
      });
    }

    // Update request status
    await client.query(
      `UPDATE join_requests 
       SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP
       WHERE request_id = $3`,
      [status, reviewerId, requestId]
    );

    // If approved, add user as member
    if (status === "APPROVED") {
      // Get next rotation position
      const positionResult = await client.query(
        "SELECT COALESCE(MAX(rotation_position), 0) + 1 as next_position FROM chama_members WHERE chama_id = $1",
        [joinRequest.chama_id]
      );
      const nextPosition = positionResult.rows[0].next_position;

      await client.query(
        `INSERT INTO chama_members (chama_id, user_id, role, rotation_position)
         VALUES ($1, $2, 'MEMBER', $3)`,
        [joinRequest.chama_id, joinRequest.user_id, nextPosition]
      );

      // Update total members count
      await client.query(
        "UPDATE chamas SET total_members = total_members + 1 WHERE chama_id = $1",
        [joinRequest.chama_id]
      );
    }

    // Get chama name for notification
    const chamaResult = await client.query(
      "SELECT chama_name FROM chamas WHERE chama_id = $1",
      [joinRequest.chama_id]
    );
    const chamaName = chamaResult.rows[0].chama_name;

    // Notify the requester
    const { createNotification } = require("../utils/notifications");
    const notificationMessage =
      status === "APPROVED"
        ? `Your request to join ${chamaName} has been approved!`
        : `Your request to join ${chamaName} has been declined.`;

    await createNotification({
      userId: joinRequest.user_id,
      type: status === "APPROVED" ? "JOIN_APPROVED" : "JOIN_REJECTED",
      title:
        status === "APPROVED"
          ? "Join Request Approved"
          : "Join Request Declined",
      message: notificationMessage,
      link:
        status === "APPROVED"
          ? `/chamas/${joinRequest.chama_id}`
          : "/my-join-requests",
      relatedId: requestId,
    });

    await client.query("COMMIT");

    res.json({
      success: true,
      message: `Join request ${status.toLowerCase()} successfully`,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Respond to request error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing join request",
    });
  } finally {
    client.release();
  }
};

// @desc    Get user's own join requests
// @route   GET /api/join-requests/my-requests
// @access  Private
const getMyRequests = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const result = await pool.query(
      `SELECT jr.*, c.chama_name, c.chama_type, c.description,
              r.first_name as reviewer_first_name, r.last_name as reviewer_last_name
       FROM join_requests jr
       JOIN chamas c ON jr.chama_id = c.chama_id
       LEFT JOIN users r ON jr.reviewed_by = r.user_id
       WHERE jr.user_id = $1
       ORDER BY jr.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get my requests error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching your join requests",
    });
  }
};

module.exports = {
  requestToJoin,
  getJoinRequests,
  respondToRequest,
  getMyRequests,
};
