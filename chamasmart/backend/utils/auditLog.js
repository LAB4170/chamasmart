const pool = require('../config/db');
const logger = require('../utils/logger');

/**
 * Audit Logging System
 * Tracks all critical operations for compliance and security
 */

/**
 * Log audit event
 * @param {Object} event - Audit event details
 */
async function logAudit(event) {
    const {
        userId,
        action,
        resource,
        resourceId,
        changes,
        ipAddress,
        userAgent,
        status = 'success',
        errorMessage = null,
    } = event;

    try {
        await pool.query(
            `INSERT INTO audit_logs 
       (user_id, action, resource, resource_id, changes, ip_address, user_agent, status, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
            [
                userId,
                action,
                resource,
                resourceId,
                JSON.stringify(changes),
                ipAddress,
                userAgent,
                status,
                errorMessage,
            ]
        );

        logger.info('Audit log created', {
            userId,
            action,
            resource,
            resourceId,
            status,
        });
    } catch (error) {
        logger.error('Failed to create audit log', {
            error: error.message,
            event,
        });
    }
}

/**
 * Audit middleware
 * Automatically logs all write operations
 */
const auditMiddleware = (req, res, next) => {
    // Store original send function
    const originalSend = res.send.bind(res);

    // Override send to log after response
    res.send = function (data) {
        // Only log write operations
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
            // Log asynchronously after response
            setImmediate(() => {
                logAudit({
                    userId: req.user?.user_id,
                    action: `${req.method} ${req.path}`,
                    resource: req.path.split('/')[2] || 'unknown', // Extract resource from path
                    resourceId: req.params.id || req.params.chamaId || null,
                    changes: {
                        body: req.body,
                        params: req.params,
                        query: req.query,
                    },
                    ipAddress: req.ip,
                    userAgent: req.get('user-agent'),
                    status: res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failure',
                    errorMessage: res.statusCode >= 400 ? data : null,
                });
            });
        }

        return originalSend(data);
    };

    next();
};

/**
 * Get audit logs for a user
 * @param {number} userId - User ID
 * @param {Object} options - Query options
 */
async function getUserAuditLogs(userId, options = {}) {
    const {
        limit = 100,
        offset = 0,
        startDate = null,
        endDate = null,
        action = null,
    } = options;

    let query = `
    SELECT * FROM audit_logs
    WHERE user_id = $1
  `;
    const params = [userId];
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

    if (action) {
        query += ` AND action LIKE $${paramIndex}`;
        params.push(`%${action}%`);
        paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
}

/**
 * Get audit logs for a resource
 * @param {string} resource - Resource type
 * @param {number} resourceId - Resource ID
 */
async function getResourceAuditLogs(resource, resourceId) {
    const result = await pool.query(
        `SELECT * FROM audit_logs
     WHERE resource = $1 AND resource_id = $2
     ORDER BY created_at DESC
     LIMIT 100`,
        [resource, resourceId]
    );

    return result.rows;
}

/**
 * Create audit logs table if not exists
 */
async function createAuditLogsTable() {
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        audit_id SERIAL PRIMARY KEY,
        user_id INTEGER,
        action VARCHAR(255) NOT NULL,
        resource VARCHAR(100),
        resource_id VARCHAR(100),
        changes JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        status VARCHAR(20) DEFAULT 'success',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resource_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    `);

        logger.info('Audit logs table created/verified');
    } catch (error) {
        logger.error('Failed to create audit logs table', {
            error: error.message,
        });
    }
}

// Create table on module load
createAuditLogsTable();

module.exports = {
    logAudit,
    auditMiddleware,
    getUserAuditLogs,
    getResourceAuditLogs,
};
