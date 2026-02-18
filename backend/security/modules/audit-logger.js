/**
 * Audit Logger - Revised
 * Comprehensive audit trail for KDPA/GDPR compliance
 *
 * Improvements:
 * - Strict mode option (fail request if audit fails)
 * - Batch logging support
 * - Better error handling
 * - Query optimization
 * - Retention policy support
 */

const pool = require('../../config/db');
const logger = require('../../utils/logger');

class AuditLogger {
  constructor(options = {}) {
    this.strictMode = options.strictMode || process.env.AUDIT_STRICT_MODE === 'true';
    this.batchSize = options.batchSize || 100;
    this.batchQueue = [];
    this.flushInterval = null;

    // Start batch flushing if enabled
    if (options.enableBatching) {
      this.startBatchFlushing();
    }

    logger.info('Audit Logger initialized', {
      strictMode: this.strictMode,
      batchingEnabled: options.enableBatching,
    });
  }

  /**
   * Log data access event
   */
  async logDataAccess(userId, action, resource, resourceId, metadata = {}) {
    const entry = {
      type: 'data_access',
      data: {
        user_id: userId,
        action,
        resource_type: resource,
        resource_id: resourceId,
        ip_address: metadata.ip_address || null,
        user_agent: metadata.user_agent || null,
        metadata: JSON.stringify({
          ...metadata,
          timestamp: new Date().toISOString(),
        }),
      },
    };

    return this.logEntry(entry);
  }

  /**
   * Log authentication event
   */
  async logAuthenticationEvent(
    userId,
    eventType,
    success,
    ipAddress,
    userAgent,
    details = '',
  ) {
    const entry = {
      type: 'authentication',
      data: {
        user_id: userId,
        event_type: eventType,
        ip_address: ipAddress,
        user_agent: userAgent,
        status: success ? 'SUCCESS' : 'FAILURE',
        metadata: JSON.stringify({
          details,
          timestamp: new Date().toISOString(),
        }),
      },
    };

    return this.logEntry(entry);
  }

  /**
   * Log financial transaction
   */
  async logFinancialTransaction(
    userId,
    transactionType,
    amount,
    chamaId,
    metadata = {},
  ) {
    const entry = {
      type: 'financial',
      data: {
        user_id: userId,
        transaction_type: transactionType,
        amount,
        chama_id: chamaId,
        status: metadata.status || 'COMPLETED',
        metadata: JSON.stringify({
          ...metadata,
          timestamp: new Date().toISOString(),
          amount_in_cents: Math.round(amount * 100),
        }),
      },
    };

    return this.logEntry(entry);
  }

  /**
   * Log consent event
   */
  async logConsentEvent(userId, consentType, granted, metadata = {}) {
    const entry = {
      type: 'consent',
      data: {
        user_id: userId,
        consent_type: consentType,
        granted,
        ip_address: metadata.ip_address || null,
        consent_version: metadata.consent_version || '1.0',
        metadata: JSON.stringify({
          ...metadata,
          timestamp: new Date().toISOString(),
        }),
      },
    };

    return this.logEntry(entry);
  }

  /**
   * Log sensitive operation
   */
  async logSensitiveOperation(
    userId,
    operation,
    resource,
    changes,
    reason = null,
  ) {
    const entry = {
      type: 'sensitive_operation',
      data: {
        user_id: userId,
        operation,
        resource,
        changes: JSON.stringify(changes),
        reason,
        timestamp: new Date().toISOString(),
      },
    };

    return this.logEntry(entry);
  }

  /**
   * Log data export
   */
  async logDataExport(userId, exportType, metadata = {}) {
    const entry = {
      type: 'data_export',
      data: {
        user_id: userId,
        export_type: exportType,
        exported_by_user_id: metadata.exported_by_user_id || userId,
        metadata: JSON.stringify({
          ...metadata,
          timestamp: new Date().toISOString(),
        }),
      },
    };

    return this.logEntry(entry);
  }

  /**
   * Log data deletion
   */
  async logDataDeletion(userId, deletionType, metadata = {}) {
    const entry = {
      type: 'deletion',
      data: {
        user_id: userId,
        deletion_type: deletionType,
        requested_by_user_id: metadata.requested_by_user_id || userId,
        metadata: JSON.stringify({
          ...metadata,
          timestamp: new Date().toISOString(),
        }),
      },
    };

    return this.logEntry(entry);
  }

  /**
   * Core logging function
   */
  async logEntry(entry) {
    try {
      // Determine table name based on type
      const tableMap = {
        data_access: 'audit_logs',
        authentication: 'auth_audit_logs',
        financial: 'financial_audit_logs',
        consent: 'consent_audit_logs',
        data_export: 'data_export_logs',
        deletion: 'deletion_audit_logs',
        sensitive_operation: 'audit_logs', // Generic fallback
      };

      const tableName = tableMap[entry.type] || 'audit_logs';
      const { data } = entry;

      // Build query based on available fields
      const fields = Object.keys(data).filter(k => data[k] !== undefined);
      const values = fields.map(k => data[k]);
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');

      const query = `
        INSERT INTO ${tableName} (${fields.join(', ')}, created_at)
        VALUES (${placeholders}, NOW())
        RETURNING *
      `;

      const result = await pool.query(query, values);

      logger.debug(`Audit logged: ${entry.type}`, {
        table: tableName,
        userId: data.user_id,
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Audit logging failed', {
        error: error.message,
        type: entry.type,
        strictMode: this.strictMode,
      });

      // In strict mode, throw error to fail the request
      if (this.strictMode) {
        throw new Error(`Audit logging failed: ${error.message}`);
      }

      // In non-strict mode, return null but log error
      return null;
    }
  }

  /**
   * Batch logging support
   */
  async logBatch(entries) {
    const results = [];

    for (const entry of entries) {
      try {
        const result = await this.logEntry(entry);
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Start automatic batch flushing
   */
  startBatchFlushing(intervalMs = 5000) {
    if (this.flushInterval) {
      return; // Already started
    }

    this.flushInterval = setInterval(async () => {
      if (this.batchQueue.length > 0) {
        const batch = this.batchQueue.splice(0, this.batchSize);
        await this.logBatch(batch);
      }
    }, intervalMs);

    logger.info('Batch flushing started', { intervalMs });
  }

  /**
   * Stop batch flushing
   */
  stopBatchFlushing() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Get audit trail for resource
   */
  async getAuditTrail(resource, resourceId, limit = 100) {
    try {
      const query = `
        SELECT 
          audit_id,
          user_id,
          action,
          resource_type,
          resource_id,
          metadata,
          created_at
        FROM audit_logs
        WHERE resource_type = $1 AND resource_id = $2
        ORDER BY created_at DESC
        LIMIT $3
      `;

      const result = await pool.query(query, [resource, resourceId, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to retrieve audit trail', {
        error: error.message,
        resource,
        resourceId,
      });
      return [];
    }
  }

  /**
   * Get user audit trail
   */
  async getUserAuditTrail(userId, days = 30, limit = 500) {
    try {
      const query = `
        SELECT 
          audit_id,
          user_id,
          action,
          resource_type,
          resource_id,
          metadata,
          created_at
        FROM audit_logs
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to retrieve user audit trail', {
        error: error.message,
        userId,
      });
      return [];
    }
  }

  /**
   * Get authentication history
   */
  async getAuthenticationHistory(userId, days = 90, limit = 100) {
    try {
      const query = `
        SELECT 
          event_type,
          ip_address,
          user_agent,
          status,
          metadata,
          created_at
        FROM auth_audit_logs
        WHERE user_id = $1
          AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to retrieve authentication history', {
        error: error.message,
        userId,
      });
      return [];
    }
  }

  /**
   * Get financial audit trail
   */
  async getFinancialAuditTrail(
    userId = null,
    chamaId = null,
    days = 365,
    limit = 1000,
  ) {
    try {
      let query = `
        SELECT 
          user_id,
          transaction_type,
          amount,
          chama_id,
          status,
          metadata,
          created_at
        FROM financial_audit_logs
        WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      `;

      const params = [];
      let paramIndex = 1;

      if (userId) {
        query += ` AND user_id = $${paramIndex++}`;
        params.push(userId);
      }

      if (chamaId) {
        query += ` AND chama_id = $${paramIndex++}`;
        params.push(chamaId);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to retrieve financial audit trail', {
        error: error.message,
        userId,
        chamaId,
      });
      return [];
    }
  }

  /**
   * Clean old audit logs (retention policy)
   */
  async cleanOldLogs(retentionDays = 730) {
    // 2 years default
    try {
      const tables = [
        'audit_logs',
        'auth_audit_logs',
        'financial_audit_logs',
        'consent_audit_logs',
        'data_export_logs',
        'deletion_audit_logs',
      ];

      const results = {};

      for (const table of tables) {
        const query = `
          DELETE FROM ${table}
          WHERE created_at < NOW() - INTERVAL '${parseInt(retentionDays)} days'
        `;

        const result = await pool.query(query);
        results[table] = result.rowCount;

        logger.info(`Cleaned old audit logs from ${table}`, {
          deletedRows: result.rowCount,
          retentionDays,
        });
      }

      return results;
    } catch (error) {
      logger.error('Failed to clean old audit logs', {
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = AuditLogger;
