/**
 * Audit Log Viewing Controller
 * Location: chamasmart/backend/controllers/auditController.js
 *
 * Provides endpoints for admins to view and analyze audit logs
 */

const {
  getUserAuditLogs,
  getChamaAuditLogs,
  getSecurityEvents,
  getResourceAuditLogs,
  EVENT_TYPES,
  SEVERITY,
} = require("../utils/auditLog");
const pool = require("../config/db");

// ============================================================================
// GET USER'S AUDIT LOGS
// ============================================================================

/**
 * Get audit logs for a specific user
 * @route GET /api/audit/users/:userId
 * @access Private (Admin or self)
 */
const getUserLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit, page, startDate, endDate, action } = req.query;

    // Authorization: Only admins or the user themselves can view
    if (req.user.user_id !== parseInt(userId) && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view these logs",
      });
    }

    const pageSize = Math.min(parseInt(limit) || 100, 100); // Max 100 items per page
    const currentPage = parseInt(page) || 1;
    const pageOffset = pageSize * (currentPage - 1);

    const { logs, total } = await getUserAuditLogs(userId, {
      limit: pageSize,
      offset: pageOffset,
      startDate,
      endDate,
      action,
    });

    const totalPages = Math.ceil(total / pageSize);

    return res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: currentPage,
        pageSize,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
    });
  } catch (error) {
    console.error("Get user logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching audit logs",
    });
  }
};

// ============================================================================
// GET CHAMA AUDIT LOGS
// ============================================================================

/**
 * Get all audit logs for a chama
 * @route GET /api/audit/chamas/:chamaId
 * @access Private (Chama officials)
 */
const getChamaLogs = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const { limit, page, severity, eventType } = req.query;

    // Check if user is a member/official of this chama
    const memberCheck = await pool.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND is_active = true`,
      [chamaId, req.user.user_id],
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view these logs",
      });
    }

    const pageSize = Math.min(parseInt(limit) || 100, 100);
    const currentPage = parseInt(page) || 1;
    const pageOffset = pageSize * (currentPage - 1);

    const { logs, total } = await getChamaAuditLogs(chamaId, {
      limit: pageSize,
      offset: pageOffset,
      severity,
      eventType, // Pass eventType to filter at DB level for better performance
    });

    const totalPages = Math.ceil(total / pageSize);

    return res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: currentPage,
        pageSize,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
    });
  } catch (error) {
    console.error("Get chama logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching chama audit logs",
    });
  }
};

// ============================================================================
// GET SECURITY EVENTS
// ============================================================================

/**
 * Get recent security events (high/critical severity)
 * @route GET /api/audit/security
 * @access Private (Admin only)
 */
const getSecurityLogs = async (req, res) => {
  try {
    // Only admins can view security logs
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { hours, limit, page } = req.query;
    const hoursToCheck = parseInt(hours) || 24;
    const pageSize = Math.min(parseInt(limit) || 50, 100);
    const currentPage = parseInt(page) || 1;

    const pageOffset = pageSize * (currentPage - 1);
    const { logs, total } = await getSecurityEvents(hoursToCheck, {
      limit: pageSize,
      offset: pageOffset,
    });

    const totalPages = Math.ceil(total / pageSize);

    return res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: currentPage,
        pageSize,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
    });
  } catch (error) {
    console.error("Get security logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching security logs",
    });
  }
};

// ============================================================================
// GET AUDIT SUMMARY/STATISTICS
// ============================================================================

/**
 * Get audit log statistics for a chama
 * @route GET /api/audit/chamas/:chamaId/summary
 * @access Private (Chama officials)
 */
const getChamaSummary = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const { days } = req.query;

    // Check authorization
    const memberCheck = await pool.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND is_active = true`,
      [chamaId, req.user.user_id],
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    const daysFilter = parseInt(days) || 30;

    const summary = await pool.query(
      `SELECT 
         event_type,
         severity,
         COUNT(*) as count,
         MAX(created_at) as last_occurrence
       FROM audit_logs
       WHERE chama_id = $1
         AND created_at >= NOW() - INTERVAL '${daysFilter} days'
       GROUP BY event_type, severity
       ORDER BY count DESC`,
      [chamaId],
    );

    // Get top users by activity
    const topUsers = await pool.query(
      `SELECT 
         al.user_id,
         u.first_name || ' ' || u.last_name as name,
         COUNT(*) as action_count
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.user_id
       WHERE al.chama_id = $1
         AND al.created_at >= NOW() - INTERVAL '${daysFilter} days'
       GROUP BY al.user_id, u.first_name, u.last_name
       ORDER BY action_count DESC
       LIMIT 10`,
      [chamaId],
    );

    // Get daily activity trend
    const dailyTrend = await pool.query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as count
       FROM audit_logs
       WHERE chama_id = $1
         AND created_at >= NOW() - INTERVAL '${daysFilter} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [chamaId],
    );

    return res.json({
      success: true,
      data: {
        eventSummary: summary.rows,
        topUsers: topUsers.rows,
        dailyTrend: dailyTrend.rows,
      },
    });
  } catch (error) {
    console.error("Get chama summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching summary",
    });
  }
};

// ============================================================================
// EXPORT AUDIT LOGS AS CSV
// ============================================================================

/**
 * Export chama audit logs as CSV
 * @route GET /api/audit/chamas/:chamaId/export
 * @access Private (Treasurer/Chairperson)
 */
const exportChamaLogs = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const { startDate, endDate } = req.query;

    // Check authorization - only Treasurer/Chairperson
    const memberCheck = await pool.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND is_active = true`,
      [chamaId, req.user.user_id],
    );

    if (
      memberCheck.rows.length === 0 ||
      !["TREASURER", "CHAIRPERSON"].includes(memberCheck.rows[0].role)
    ) {
      return res.status(403).json({
        success: false,
        message: "Treasurer or Chairperson access required",
      });
    }

    // Build query
    let query = `
      SELECT 
        audit_id,
        event_type,
        user_id,
        action,
        resource,
        resource_id,
        severity,
        ip_address,
        created_at
      FROM audit_logs
      WHERE chama_id = $1
    `;

    const params = [chamaId];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += " ORDER BY created_at DESC";

    const result = await pool.query(query, params);

    // Convert to CSV
    const headers = [
      "audit_id",
      "event_type",
      "user_id",
      "action",
      "resource",
      "resource_id",
      "severity",
      "ip_address",
      "created_at",
    ];

    const csvRows = [headers.join(",")];

    for (const row of result.rows) {
      const values = headers.map((header) => {
        const value = row[header];
        // Escape commas and quotes
        const escaped = String(value).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(","));
    }

    const csv = csvRows.join("\n");
    const filename = `chama_${chamaId}_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    return res.send(csv);
  } catch (error) {
    console.error("Export logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Error exporting logs",
    });
  }
};

module.exports = {
  getUserLogs,
  getChamaLogs,
  getSecurityLogs,
  getChamaSummary,
  exportChamaLogs,
};
