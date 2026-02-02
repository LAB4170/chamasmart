/**
 * Enhanced Audit Logging System
 * Location: chamasmart/backend/utils/auditLog.js
 *
 * This is a drop-in replacement for your existing auditLog.js
 * Maintains backward compatibility while adding enterprise features
 */

const pool = require('../config/db');
const logger = require('./logger');

// ============================================================================
// EVENT TYPE CONSTANTS
// ============================================================================

const EVENT_TYPES = {
  // Authentication
  AUTH_LOGIN: 'auth_login',
  AUTH_LOGOUT: 'auth_logout',
  AUTH_REGISTER: 'auth_register',
  AUTH_PASSWORD_RESET: 'auth_password_reset',
  AUTH_FAILED_LOGIN: 'auth_failed_login',
  AUTH_ACCOUNT_LOCKED: 'auth_account_locked',

  // Financial Transactions
  CONTRIBUTION_CREATED: 'contribution_created',
  CONTRIBUTION_UPDATED: 'contribution_updated',
  CONTRIBUTION_DELETED: 'contribution_deleted',
  LOAN_APPLIED: 'loan_applied',
  LOAN_APPROVED: 'loan_approved',
  LOAN_REPAYMENT: 'loan_repayment',
  LOAN_DEFAULTED: 'loan_defaulted',
  PAYOUT_PROCESSED: 'payout_processed',

  // Configuration
  CONFIG_UPDATED: 'config_updated',
  ROLE_CHANGED: 'role_changed',
  MEMBER_ADDED: 'member_added',
  MEMBER_REMOVED: 'member_removed',

  // Security
  SECURITY_BREACH_ATTEMPT: 'security_breach_attempt',
  SECURITY_SUSPICIOUS_ACTIVITY: 'security_suspicious_activity',

  // System
  SYSTEM_ERROR: 'system_error',
  AUTH_FAILED: 'auth_failed',
};

const SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// ============================================================================
// BACKWARD COMPATIBLE: Your Original logAudit Function
// ============================================================================

/**
 * Log audit event (ORIGINAL FUNCTION - Backward Compatible)
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
       (user_id, action, entity_type, entity_id, metadata, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        userId,
        action,
        resource,
        resourceId,
        JSON.stringify({ ...changes, status, errorMessage }),
        ipAddress,
        userAgent,
      ],
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

// ============================================================================
// ENHANCED: New logAuditEvent Function with More Features
// ============================================================================

/**
 * Enhanced audit logging with severity levels and event types
 * @param {Object} params - Audit parameters
 */
async function logAuditEvent({
  eventType, // Use EVENT_TYPES constants
  userId,
  action,
  entityType, // 'chama', 'loan', 'user', etc.
  entityId,
  metadata = {},
  ipAddress,
  userAgent,
  severity = SEVERITY.LOW,
  chamaId = null,
}) {
  try {
    // Sanitize metadata to remove sensitive data
    const sanitizedMetadata = sanitizeMetadata(metadata);

    await pool.query(
      `INSERT INTO audit_logs 
       (user_id, action, entity_type, entity_id, metadata, 
        ip_address, user_agent, severity, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        userId,
        `${eventType}: ${action}`,
        entityType,
        entityId,
        JSON.stringify({ ...sanitizedMetadata, chamaId }),
        ipAddress,
        userAgent,
        severity.toUpperCase(),
      ],
    );

    // Log to Winston for immediate visibility
    const logLevel = severity === SEVERITY.CRITICAL || severity === SEVERITY.HIGH
      ? 'warn'
      : 'info';

    logger[logLevel](`[AUDIT] ${eventType}: ${action}`, {
      userId,
      entityType,
      entityId,
      severity,
      chamaId,
    });
  } catch (error) {
    // Don't let audit failures break the application
    logger.error('Failed to write audit log', {
      error: error.message,
      eventType,
      userId,
      action,
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sanitize metadata to remove sensitive information
 */
function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  const sensitiveFields = [
    'password',
    'passwordHash',
    'password_hash',
    'token',
    'accessToken',
    'refreshToken',
    'secret',
    'apiKey',
    'creditCard',
    'cvv',
    'pin',
  ];

  const sanitized = { ...metadata };

  function redactObject(obj) {
    for (const key in obj) {
      if (
        sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))
      ) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        redactObject(obj[key]);
      }
    }
  }

  redactObject(sanitized);
  return sanitized;
}

/**
 * Determine severity based on event type
 */
function determineSeverity(eventType) {
  const criticalEvents = [
    EVENT_TYPES.LOAN_DEFAULTED,
    EVENT_TYPES.SECURITY_BREACH_ATTEMPT,
    EVENT_TYPES.AUTH_ACCOUNT_LOCKED,
  ];

  const highEvents = [
    EVENT_TYPES.LOAN_APPROVED,
    EVENT_TYPES.PAYOUT_PROCESSED,
    EVENT_TYPES.CONFIG_UPDATED,
    EVENT_TYPES.ROLE_CHANGED,
    EVENT_TYPES.MEMBER_REMOVED,
  ];

  if (criticalEvents.includes(eventType)) {
    return SEVERITY.CRITICAL;
  } if (highEvents.includes(eventType)) {
    return SEVERITY.HIGH;
  }
  return SEVERITY.MEDIUM;
}

// ============================================================================
// BACKWARD COMPATIBLE: Your Original Middleware
// ============================================================================

/**
 * Audit middleware (ORIGINAL - Backward Compatible)
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
          resource: req.path.split('/')[2] || 'unknown',
          resourceId: req.params.id || req.params.chamaId || null,
          changes: {
            body: sanitizeMetadata(req.body),
            params: req.params,
            query: req.query,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          status:
            res.statusCode >= 200 && res.statusCode < 300
              ? 'success'
              : 'failure',
          errorMessage: res.statusCode >= 400 ? data : null,
        });
      });
    }

    return originalSend(data);
  };

  next();
};

// ============================================================================
// ENHANCED: Smart Audit Middleware with Event Types
// ============================================================================

/**
 * Enhanced audit middleware that uses event types
 */
const auditMiddlewareEnhanced = (req, res, next) => {
  const originalSend = res.send.bind(res);
  const startTime = Date.now();

  res.send = function (data) {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      setImmediate(() => {
        const duration = Date.now() - startTime;
        const eventType = mapRouteToEventType(req.method, req.path);
        const severity = res.statusCode >= 400 ? SEVERITY.HIGH : determineSeverity(eventType);

        logAuditEvent({
          eventType,
          userId: req.user?.user_id || null,
          action: `${req.method} ${req.path}`,
          entityType: extractEntityType(req.path),
          entityId:
            req.params.id || req.params.chamaId || req.params.loanId || null,
          metadata: {
            body: req.body,
            params: req.params,
            query: req.query,
            statusCode: res.statusCode,
            duration,
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          severity,
          chamaId: req.params.chamaId || null,
        });
      });
    }

    return originalSend(data);
  };

  next();
};

/**
 * Map route and method to event type
 */
function mapRouteToEventType(method, path) {
  // Authentication routes
  if (path.includes('/auth/login')) return EVENT_TYPES.AUTH_LOGIN;
  if (path.includes('/auth/register')) return EVENT_TYPES.AUTH_REGISTER;
  if (path.includes('/auth/logout')) return EVENT_TYPES.AUTH_LOGOUT;

  // Contribution routes
  if (path.includes('/contributions') && method === 'POST') {
    return EVENT_TYPES.CONTRIBUTION_CREATED;
  }
  if (path.includes('/contributions') && method === 'DELETE') {
    return EVENT_TYPES.CONTRIBUTION_DELETED;
  }

  // Loan routes
  if (path.includes('/loans') && path.includes('/apply')) {
    return EVENT_TYPES.LOAN_APPLIED;
  }
  if (path.includes('/loans') && path.includes('/approve')) {
    return EVENT_TYPES.LOAN_APPROVED;
  }
  if (path.includes('/loans') && path.includes('/repay')) {
    return EVENT_TYPES.LOAN_REPAYMENT;
  }

  // Member routes
  if (path.includes('/members') && method === 'POST') {
    return EVENT_TYPES.MEMBER_ADDED;
  }
  if (path.includes('/members') && method === 'DELETE') {
    return EVENT_TYPES.MEMBER_REMOVED;
  }

  // Default
  return `${method.toLowerCase()}_${extractEntityType(path)}`;
}

/**
 * Extract entity type from path
 */
function extractEntityType(path) {
  const segments = path.split('/').filter(Boolean);
  // Usually the entity type is the second or third segment
  // e.g., /api/chamas/:id -> 'chama'
  // e.g., /api/loans/:id/repay -> 'loan'

  if (segments.includes('chamas')) return 'chama';
  if (segments.includes('loans')) return 'loan';
  if (segments.includes('contributions')) return 'contribution';
  if (segments.includes('members')) return 'member';
  if (segments.includes('users')) return 'user';

  return segments[1] || 'unknown';
}

// ============================================================================
// QUERY FUNCTIONS (Your Original Functions)
// ============================================================================

/**
 * Get audit logs for a user
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
 */
async function getResourceAuditLogs(resource, resourceId) {
  const result = await pool.query(
    `SELECT * FROM audit_logs
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY created_at DESC
     LIMIT 100`,
    [resource, resourceId],
  );

  return result.rows;
}

/**
 * Get audit logs for a chama
 */
async function getChamaAuditLogs(chamaId, options = {}) {
  const { limit = 100, offset = 0, severity = null } = options;

  let query = `
    SELECT * FROM audit_logs
    WHERE metadata->>'chamaId' = $1
  `;
  const params = [chamaId];
  let paramIndex = 2;

  if (severity) {
    query += ` AND severity = $${paramIndex}`;
    params.push(severity);
    paramIndex++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get security events (high/critical severity)
 */
async function getSecurityEvents(hours = 24) {
  const result = await pool.query(
    `SELECT * FROM audit_logs
     WHERE severity IN ('high', 'critical')
       AND created_at >= NOW() - INTERVAL '${hours} hours'
     ORDER BY created_at DESC
     LIMIT 100`,
  );

  return result.rows;
}

// ============================================================================
// DATABASE SETUP
// ============================================================================

/**
 * Create/Update audit logs table with new columns
 */
async function createAuditLogsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        audit_id SERIAL PRIMARY KEY,
        event_type VARCHAR(100),
        user_id INTEGER,
        action VARCHAR(255) NOT NULL,
        resource VARCHAR(100),
        resource_id VARCHAR(100),
        changes JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        status VARCHAR(20) DEFAULT 'success',
        error_message TEXT,
        severity VARCHAR(20) DEFAULT 'low',
        chama_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Add new columns if they don't exist (for existing tables)
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'audit_logs' AND column_name = 'event_type'
        ) THEN
          ALTER TABLE audit_logs ADD COLUMN event_type VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'audit_logs' AND column_name = 'severity'
        ) THEN
          ALTER TABLE audit_logs ADD COLUMN severity VARCHAR(20) DEFAULT 'low';
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'audit_logs' AND column_name = 'chama_id'
        ) THEN
          ALTER TABLE audit_logs ADD COLUMN chama_id INTEGER;
        END IF;
      END $$;

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resource_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_chama_id ON audit_logs(chama_id);
    `);

    logger.info('Audit logs table created/updated successfully');
  } catch (error) {
    logger.error('Failed to create/update audit logs table', {
      error: error.message,
    });
  }
}

// Create/update table on module load
// createAuditLogsTable(); // Removing top-level call

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Original functions (backward compatible)
  logAudit,
  auditMiddleware,
  getUserAuditLogs,
  getResourceAuditLogs,

  // Enhanced functions
  logAuditEvent,
  auditMiddlewareEnhanced,
  getChamaAuditLogs,
  getSecurityEvents,

  // Constants
  EVENT_TYPES,
  SEVERITY,

  // Utilities
  sanitizeMetadata,
  determineSeverity,
};
