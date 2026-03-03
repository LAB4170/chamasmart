/**
 * Audit Log Controller - REWRITTEN FOR RELIABILITY
 * All SQL is inline — no dependency on auditLog.js query helpers
 */

const pool = require('../config/db');

// ============================================================================
// GET CHAMA AUDIT LOGS
// ============================================================================
const getChamaLogs = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const userId = req.user.user_id;

    console.log(`[AUDIT] getChamaLogs called: chamaId=${chamaId} userId=${userId}`);

    // Check membership
    const memberCheck = await pool.query(
      `SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true`,
      [chamaId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized to view these logs' });
    }

    const chamaIdStr = chamaId.toString();

    const { action, user, startDate, endDate, page = 1, limit = 100 } = req.query;

    let queryStr = `
      SELECT
        al.audit_id,
        al.user_id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.ip_address,
        al.user_agent,
        al.severity,
        al.metadata,
        al.created_at,
        COALESCE(u.first_name || ' ' || u.last_name, 'System') AS user_name,
        u.email AS user_email,
        COUNT(*) OVER() AS total_count
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      WHERE al.metadata->>'chamaId' = $1
    `;

    const params = [chamaIdStr];
    let paramIndex = 2;

    if (action) {
      queryStr += ` AND al.action ILIKE $${paramIndex}`;
      params.push(`%${action}%`);
      paramIndex++;
    }

    if (user) {
      queryStr += ` AND (u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      params.push(`%${user}%`);
      paramIndex++;
    }

    if (startDate) {
      queryStr += ` AND al.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      queryStr += ` AND al.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    const offset = (Math.max(1, parseInt(page)) - 1) * Math.max(1, parseInt(limit));
    queryStr += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Math.max(1, parseInt(limit)), offset);

    // Fetch logs
    const result = await pool.query(queryStr, params);

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

    console.log(`[AUDIT] getChamaLogs success: ${result.rowCount} rows returned`);

    return res.json({
      success: true,
      data: result.rows,
      pagination: { total, page: 1, pageSize: 100, totalPages: Math.ceil(total / 100) }
    });

  } catch (error) {
    console.error('[AUDIT] getChamaLogs FULL ERROR:', error.message);
    console.error(error.stack);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================================
// GET CHAMA AUDIT SUMMARY
// ============================================================================
const getChamaSummary = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const userId = req.user.user_id;

    console.log(`[AUDIT] getChamaSummary called: chamaId=${chamaId} userId=${userId}`);

    // Check membership
    const memberCheck = await pool.query(
      `SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true`,
      [chamaId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const chamaIdStr = chamaId.toString();

    const stats = await pool.query(`
      SELECT
        COUNT(*) AS total_actions,
        COUNT(DISTINCT user_id) AS unique_users,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) AS today_actions,
        COUNT(*) FILTER (WHERE severity IN ('HIGH', 'CRITICAL')) AS critical_actions
      FROM audit_logs
      WHERE metadata->>'chamaId' = $1
    `, [chamaIdStr]);

    console.log(`[AUDIT] getChamaSummary success:`, stats.rows[0]);

    return res.json({
      success: true,
      data: {
        total_actions: parseInt(stats.rows[0].total_actions) || 0,
        unique_users: parseInt(stats.rows[0].unique_users) || 0,
        today_actions: parseInt(stats.rows[0].today_actions) || 0,
        critical_actions: parseInt(stats.rows[0].critical_actions) || 0,
      }
    });

  } catch (error) {
    console.error('[AUDIT] getChamaSummary FULL ERROR:', error.message);
    console.error(error.stack);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================================
// GET USER AUDIT LOGS
// ============================================================================
const getUserLogs = async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.user_id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const result = await pool.query(
      `SELECT al.*, COALESCE(u.first_name || ' ' || u.last_name, 'System') AS user_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.user_id
       WHERE al.user_id = $1
       ORDER BY al.created_at DESC LIMIT 100`,
      [userId]
    );

    return res.json({ success: true, data: result.rows, pagination: { total: result.rowCount } });
  } catch (error) {
    console.error('[AUDIT] getUserLogs error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================================
// GET SECURITY LOGS (Admin Only)
// ============================================================================
const getSecurityLogs = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const result = await pool.query(
      `SELECT al.*, COALESCE(u.first_name || ' ' || u.last_name, 'System') AS user_name, u.email AS user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.user_id
       WHERE al.severity IN ('HIGH', 'CRITICAL')
         AND al.created_at >= NOW() - INTERVAL '24 hours'
       ORDER BY al.created_at DESC LIMIT 100`
    );

    return res.json({ success: true, data: result.rows, pagination: { total: result.rowCount } });
  } catch (error) {
    console.error('[AUDIT] getSecurityLogs error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================================
// EXPORT CHAMA LOGS AS CSV
// ============================================================================
const exportChamaLogs = async (req, res) => {
  try {
    const { chamaId } = req.params;

    const result = await pool.query(
      `SELECT al.audit_id, al.action, al.entity_type, al.entity_id, al.severity, al.ip_address, al.created_at,
              COALESCE(u.first_name || ' ' || u.last_name, 'System') AS user_name, u.email AS user_email
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.user_id
       WHERE al.metadata->>'chamaId' = $1
       ORDER BY al.created_at DESC`,
      [chamaId.toString()]
    );

    const headers = ['audit_id', 'action', 'entity_type', 'entity_id', 'severity', 'ip_address', 'created_at', 'user_name', 'user_email'];
    const csvRows = [headers.join(',')];
    for (const row of result.rows) {
      csvRows.push(headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','));
    }

    const filename = `chama_${chamaId}_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csvRows.join('\n'));

  } catch (error) {
    console.error('[AUDIT] exportChamaLogs error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getUserLogs,
  getChamaLogs,
  getSecurityLogs,
  getChamaSummary,
  exportChamaLogs,
};
