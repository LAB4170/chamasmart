/**
 * Production-Grade Member Management Controller
 * Fixes: Authorization, validation, proper error handling
 */

const pool = require("../config/db");
const { AppError } = require("../middleware/errorHandler");
const logger = require("../utils/logger");
const { body, param, validationResult } = require("express-validator");
const { logAuditEvent, EVENT_TYPES, SEVERITY } = require("../utils/auditLog");

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

const addMemberValidation = [
  param("chamaId").isInt({ min: 1 }).withMessage("Invalid chama ID"),
  body("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isInt({ min: 1 })
    .withMessage("Invalid user ID"),
  body("role")
    .optional()
    .isIn(["MEMBER", "SECRETARY", "TREASURER", "CHAIRPERSON"])
    .withMessage("Invalid role"),
];

const updateRoleValidation = [
  param("chamaId").isInt({ min: 1 }).withMessage("Invalid chama ID"),
  param("userId").isInt({ min: 1 }).withMessage("Invalid user ID"),
  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["MEMBER", "SECRETARY", "TREASURER", "CHAIRPERSON"])
    .withMessage("Invalid role"),
];

// ============================================================================
// AUTHORIZATION HELPER
// ============================================================================

async function checkChamaOfficial(client, chamaId, userId) {
  const result = await client.query(
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
      "Insufficient permissions. Only officials can perform this action.",
      403,
      "NOT_OFFICIAL",
    );
  }

  return result.rows[0].role;
}

// ============================================================================
// ADD MEMBER
// ============================================================================

const addMember = async (req, res, next) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  const client = await pool.connect();

  try {
    const { chamaId } = req.params;
    const { userId, role = "MEMBER" } = req.body;

    // Check authorization
    await checkChamaOfficial(client, chamaId, req.user.user_id);

    await client.query("BEGIN");

    // Verify chama exists and is active
    const chamaCheck = await client.query(
      "SELECT chama_id, is_active, chama_name FROM chamas WHERE chama_id = $1",
      [chamaId],
    );

    if (chamaCheck.rows.length === 0) {
      throw new AppError("Chama not found", 404, "CHAMA_NOT_FOUND");
    }

    if (!chamaCheck.rows[0].is_active) {
      throw new AppError("Chama is not active", 400, "CHAMA_INACTIVE");
    }

    // Verify user exists
    const userCheck = await client.query(
      "SELECT user_id, first_name, last_name, email FROM users WHERE user_id = $1",
      [userId],
    );

    if (userCheck.rows.length === 0) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    // Check if already a member (including inactive)
    const memberCheck = await client.query(
      "SELECT user_id, is_active FROM chama_members WHERE chama_id = $1 AND user_id = $2",
      [chamaId, userId],
    );

    if (memberCheck.rows.length > 0) {
      if (memberCheck.rows[0].is_active) {
        throw new AppError(
          "User is already an active member",
          400,
          "ALREADY_MEMBER",
        );
      } else {
        // Reactivate inactive member
        await client.query(
          `UPDATE chama_members 
           SET is_active = true, 
               role = $1, 
               join_date = NOW(),
               updated_at = NOW()
           WHERE chama_id = $2 AND user_id = $3`,
          [role, chamaId, userId],
        );

        await client.query(
          "UPDATE chamas SET total_members = total_members + 1, updated_at = NOW() WHERE chama_id = $1",
          [chamaId],
        );

        await client.query("COMMIT");

        logger.info("Member reactivated", {
          chamaId,
          userId,
          role,
          by: req.user.user_id,
        });

        return res.status(200).json({
          success: true,
          message: "Member reactivated successfully",
          data: {
            chamaId,
            userId,
            role,
            reactivated: true,
          },
        });
      }
    }

    // Get next rotation position
    const positionResult = await client.query(
      "SELECT COALESCE(MAX(rotation_position), 0) + 1 as next_position FROM chama_members WHERE chama_id = $1",
      [chamaId],
    );
    const rotationPosition = positionResult.rows[0].next_position;

    // Add new member
    const memberResult = await client.query(
      `INSERT INTO chama_members (chama_id, user_id, role, rotation_position)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [chamaId, userId, role, rotationPosition],
    );

    // Update chama member count
    await client.query(
      "UPDATE chamas SET total_members = total_members + 1, updated_at = NOW() WHERE chama_id = $1",
      [chamaId],
    );

    // Create welcome notification
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, link, related_id)
       VALUES ($1, 'MEMBER_ADDED', 'Welcome to ${chamaCheck.rows[0].chama_name}', 
               'You have been added as a ${role} to ${chamaCheck.rows[0].chama_name}', 
               '/chamas/${chamaId}', $2)`,
      [userId, chamaId],
    );

    await client.query("COMMIT");

    // Log audit event
    await logAuditEvent({
      eventType: EVENT_TYPES.MEMBER_ADDED,
      userId: req.user.user_id,
      action: "Added new member",
      entityType: "chama_member",
      entityId: userId,
      chamaId,
      metadata: {
        addedUserId: userId,
        role,
        rotationPosition,
      },
      severity: SEVERITY.MEDIUM,
    });

    logger.info("Member added", {
      chamaId,
      userId,
      role,
      by: req.user.user_id,
    });

    res.status(201).json({
      success: true,
      message: "Member added successfully",
      data: {
        ...memberResult.rows[0],
        user: userCheck.rows[0],
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
// UPDATE MEMBER ROLE
// ============================================================================

const updateMemberRole = async (req, res, next) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  const client = await pool.connect();

  try {
    const { chamaId, userId } = req.params;
    const { role } = req.body;

    // Check authorization
    const requesterRole = await checkChamaOfficial(
      client,
      chamaId,
      req.user.user_id,
    );

    // Only CHAIRPERSON can assign CHAIRPERSON role
    if (role === "CHAIRPERSON" && requesterRole !== "CHAIRPERSON") {
      throw new AppError(
        "Only the current chairperson can assign chairperson role",
        403,
        "CHAIRPERSON_ONLY",
      );
    }

    await client.query("BEGIN");

    // Check if member exists and is active
    const memberCheck = await client.query(
      "SELECT user_id, role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true",
      [chamaId, parseInt(userId)],
    );

    if (memberCheck.rows.length === 0) {
      throw new AppError(
        "Member not found or inactive",
        404,
        "MEMBER_NOT_FOUND",
      );
    }

    const oldRole = memberCheck.rows[0].role;

    // Prevent removing the last chairperson
    if (oldRole === "CHAIRPERSON" && role !== "CHAIRPERSON") {
      const chairpersonCount = await client.query(
        "SELECT COUNT(*) as count FROM chama_members WHERE chama_id = $1 AND role = $2 AND is_active = true",
        [chamaId, "CHAIRPERSON"],
      );

      if (parseInt(chairpersonCount.rows[0].count) === 1) {
        throw new AppError(
          "Cannot remove the only chairperson. Assign another chairperson first.",
          400,
          "LAST_CHAIRPERSON",
        );
      }
    }

    // Update role
    const result = await client.query(
      `UPDATE chama_members 
       SET role = $1, updated_at = NOW()
       WHERE chama_id = $2 AND user_id = $3
       RETURNING *`,
      [role, chamaId, parseInt(userId)],
    );

    // Create notification
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, link, related_id)
       VALUES ($1, 'ROLE_UPDATED', 'Role Updated', 
               'Your role has been updated from ${oldRole} to ${role}', 
               '/chamas/${chamaId}', $2)`,
      [parseInt(userId), chamaId],
    );

    await client.query("COMMIT");

    // Log audit event
    await logAuditEvent({
      eventType: EVENT_TYPES.MEMBER_ROLE_UPDATED,
      userId: req.user.user_id,
      action: "Updated member role",
      entityType: "chama_member",
      entityId: parseInt(userId),
      chamaId,
      metadata: {
        oldRole,
        newRole: role,
      },
      severity: SEVERITY.MEDIUM,
    });

    logger.info("Member role updated", {
      chamaId,
      userId: parseInt(userId),
      oldRole,
      newRole: role,
      by: req.user.user_id,
    });

    res.json({
      success: true,
      message: "Member role updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
};

// ============================================================================
// REMOVE MEMBER
// ============================================================================

const removeMember = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { chamaId, userId } = req.params;
    const { reason } = req.body;

    // Check authorization
    await checkChamaOfficial(client, chamaId, req.user.user_id);

    await client.query("BEGIN");

    // Check if member exists and is active
    const memberCheck = await client.query(
      "SELECT user_id, role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true",
      [chamaId, parseInt(userId)],
    );

    if (memberCheck.rows.length === 0) {
      throw new AppError(
        "Member not found or already inactive",
        404,
        "MEMBER_NOT_FOUND",
      );
    }

    // Prevent removing the last chairperson
    if (memberCheck.rows[0].role === "CHAIRPERSON") {
      const chairpersonCount = await client.query(
        "SELECT COUNT(*) as count FROM chama_members WHERE chama_id = $1 AND role = $2 AND is_active = true",
        [chamaId, "CHAIRPERSON"],
      );

      if (parseInt(chairpersonCount.rows[0].count) === 1) {
        throw new AppError(
          "Cannot remove the only chairperson. Assign another chairperson first.",
          400,
          "LAST_CHAIRPERSON",
        );
      }
    }

    // Check if member has outstanding loans
    const loanCheck = await client.query(
      `SELECT COUNT(*) as count FROM loans 
       WHERE borrower_id = $1 AND chama_id = $2 AND status IN ('ACTIVE', 'PENDING_APPROVAL')`,
      [parseInt(userId), chamaId],
    );

    if (parseInt(loanCheck.rows[0].count) > 0) {
      throw new AppError(
        "Cannot remove member with outstanding loans. Clear all loans first.",
        400,
        "OUTSTANDING_LOANS",
      );
    }

    // Soft delete member
    await client.query(
      `UPDATE chama_members 
       SET is_active = false, 
           removed_at = NOW(),
           removed_by = $1,
           removal_reason = $2,
           updated_at = NOW()
       WHERE chama_id = $3 AND user_id = $4`,
      [req.user.user_id, reason, chamaId, parseInt(userId)],
    );

    // Update chama member count
    await client.query(
      "UPDATE chamas SET total_members = total_members - 1, updated_at = NOW() WHERE chama_id = $1",
      [chamaId],
    );

    // Create notification
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message, related_id)
       VALUES ($1, 'MEMBER_REMOVED', 'Removed from Chama', 
               'You have been removed from the chama. Reason: ${reason || "Not specified"}', $2)`,
      [parseInt(userId), chamaId],
    );

    await client.query("COMMIT");

    // Log audit event
    await logAuditEvent({
      eventType: EVENT_TYPES.MEMBER_REMOVED,
      userId: req.user.user_id,
      action: "Removed member",
      entityType: "chama_member",
      entityId: parseInt(userId),
      chamaId,
      metadata: {
        removedUserId: parseInt(userId),
        reason,
      },
      severity: SEVERITY.HIGH,
    });

    logger.info("Member removed", {
      chamaId,
      userId: parseInt(userId),
      reason,
      by: req.user.user_id,
    });

    res.json({
      success: true,
      message: "Member removed successfully",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
};

// ============================================================================
// GET MEMBER CONTRIBUTIONS
// ============================================================================

const getMemberContributions = async (req, res, next) => {
  try {
    const { chamaId, userId } = req.params;
    const { page = 1, limit = 20, startDate, endDate } = req.query;

    // Check authorization (must be member of the chama)
    const authCheck = await pool.query(
      `SELECT 1 FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND is_active = true`,
      [chamaId, req.user.user_id],
    );

    if (authCheck.rows.length === 0) {
      throw new AppError(
        "Not authorized to view contributions",
        403,
        "NOT_AUTHORIZED",
      );
    }

    // Build query
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = `
      SELECT c.contribution_id, c.amount_cents, c.payment_method, 
             c.receipt_number, c.contribution_date, c.created_at,
             u.first_name || ' ' || u.last_name as recorded_by_name
      FROM contributions c
      LEFT JOIN users u ON c.recorded_by = u.user_id
      WHERE c.chama_id = $1 AND c.user_id = $2 AND c.is_deleted = false
    `;

    const params = [chamaId, parseInt(userId)];
    let paramIndex = 3;

    if (startDate) {
      query += ` AND c.contribution_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND c.contribution_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY c.contribution_date DESC 
               LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    // Get total
    let countQuery = `
      SELECT COUNT(*) as total, COALESCE(SUM(amount_cents), 0) as total_cents
      FROM contributions 
      WHERE chama_id = $1 AND user_id = $2 AND is_deleted = false
    `;
    const countParams = [chamaId, parseInt(userId)];

    if (startDate) {
      countQuery += ` AND contribution_date >= $3`;
      countParams.push(startDate);
    }
    if (endDate) {
      const nextParam = countParams.length + 1;
      countQuery += ` AND contribution_date <= $${nextParam}`;
      countParams.push(endDate);
    }

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
    ]);

    const contributions = result.rows.map((row) => ({
      ...row,
      amount: parseFloat((row.amount_cents / 100).toFixed(2)),
    }));

    const total = parseInt(countResult.rows[0].total);
    const totalAmount = parseFloat(
      (countResult.rows[0].total_cents / 100).toFixed(2),
    );

    res.json({
      success: true,
      data: {
        contributions,
        summary: {
          totalContributions: total,
          totalAmount,
        },
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// BULK ADD MEMBERS
// ============================================================================

const bulkAddMembers = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { chamaId } = req.params;
    const { members } = req.body; // Array of { userId, role }

    if (!Array.isArray(members) || members.length === 0) {
      throw new AppError("Members array is required", 400, "INVALID_INPUT");
    }

    if (members.length > 50) {
      throw new AppError(
        "Cannot add more than 50 members at once",
        400,
        "TOO_MANY_MEMBERS",
      );
    }

    // Check authorization
    await checkChamaOfficial(client, chamaId, req.user.user_id);

    await client.query("BEGIN");

    const results = {
      added: [],
      skipped: [],
      errors: [],
    };

    // Get next rotation position
    const positionResult = await client.query(
      "SELECT COALESCE(MAX(rotation_position), 0) as max_position FROM chama_members WHERE chama_id = $1",
      [chamaId],
    );
    let nextPosition = positionResult.rows[0].max_position + 1;

    for (const member of members) {
      try {
        const { userId, role = "MEMBER" } = member;

        // Validate
        if (!userId || !Number.isInteger(userId)) {
          results.errors.push({ userId, error: "Invalid user ID" });
          continue;
        }

        // Check if user exists
        const userCheck = await client.query(
          "SELECT user_id FROM users WHERE user_id = $1",
          [userId],
        );

        if (userCheck.rows.length === 0) {
          results.errors.push({ userId, error: "User not found" });
          continue;
        }

        // Check if already a member
        const memberCheck = await client.query(
          "SELECT user_id FROM chama_members WHERE chama_id = $1 AND user_id = $2",
          [chamaId, userId],
        );

        if (memberCheck.rows.length > 0) {
          results.skipped.push({ userId, reason: "Already a member" });
          continue;
        }

        // Add member
        await client.query(
          `INSERT INTO chama_members (chama_id, user_id, role, rotation_position)
           VALUES ($1, $2, $3, $4)`,
          [chamaId, userId, role, nextPosition],
        );

        results.added.push({ userId, role, position: nextPosition });
        nextPosition++;
      } catch (memberError) {
        results.errors.push({
          userId: member.userId,
          error: memberError.message,
        });
      }
    }

    // Update chama member count
    if (results.added.length > 0) {
      await client.query(
        "UPDATE chamas SET total_members = total_members + $1, updated_at = NOW() WHERE chama_id = $2",
        [results.added.length, chamaId],
      );
    }

    await client.query("COMMIT");

    logger.info("Bulk add members completed", {
      chamaId,
      added: results.added.length,
      skipped: results.skipped.length,
      errors: results.errors.length,
      by: req.user.user_id,
    });

    res.status(200).json({
      success: true,
      message: `Added ${results.added.length} members successfully`,
      data: results,
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
  addMember: [addMemberValidation, addMember],
  updateMemberRole: [updateRoleValidation, updateMemberRole],
  removeMember,
  getMemberContributions,
  bulkAddMembers,
};
