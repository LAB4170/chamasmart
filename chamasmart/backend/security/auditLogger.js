/**
 * Audit Logger Module
 * Implements comprehensive audit trail for KDPA 2019 compliance
 * Tracks all data access, modifications, and sensitive operations
 */

const pool = require("../config/db");
const logger = require("../utils/logger");

class AuditLogger {
  /**
   * Log data access event
   * @param {number} userId - User performing action
   * @param {string} action - Type of action (READ, CREATE, UPDATE, DELETE)
   * @param {string} resource - Resource accessed (users, chamas, contributions, etc)
   * @param {number} resourceId - ID of resource
   * @param {object} metadata - Additional metadata
   */
  static async logDataAccess(
    userId,
    action,
    resource,
    resourceId,
    metadata = {},
  ) {
    try {
      const query = `
        INSERT INTO audit_logs (
          user_id, 
          action, 
          resource_type, 
          resource_id, 
          ip_address, 
          user_agent, 
          metadata, 
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
      `;

      const values = [
        userId,
        action,
        resource,
        resourceId,
        metadata.ip_address || null,
        metadata.user_agent || null,
        JSON.stringify({
          ...metadata,
          timestamp: new Date().toISOString(),
          action_type: action,
        }),
      ];

      await pool.query(query, values);

      logger.info(
        `Audit: ${action} on ${resource} #${resourceId} by user ${userId}`,
      );
    } catch (error) {
      logger.error("Audit logging failed", { error: error.message });
    }
  }

  /**
   * Log financial transaction
   * @param {number} userId - User performing transaction
   * @param {string} transactionType - Type of transaction
   * @param {number} amount - Transaction amount
   * @param {number} chamaId - Chama involved
   * @param {object} metadata - Additional details
   */
  static async logFinancialTransaction(
    userId,
    transactionType,
    amount,
    chamaId,
    metadata = {},
  ) {
    try {
      const query = `
        INSERT INTO financial_audit_logs (
          user_id,
          transaction_type,
          amount,
          chama_id,
          status,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;

      const values = [
        userId,
        transactionType,
        amount,
        chamaId,
        metadata.status || "COMPLETED",
        JSON.stringify({
          ...metadata,
          timestamp: new Date().toISOString(),
          amount_in_cents: amount * 100,
        }),
      ];

      await pool.query(query, values);

      logger.info(
        `Financial audit: ${transactionType} for ${amount} by user ${userId}`,
      );
    } catch (error) {
      logger.error("Financial audit logging failed", { error: error.message });
    }
  }

  /**
   * Log authentication events
   * @param {number} userId - User ID (null if failed login)
   * @param {string} eventType - LOGIN, LOGOUT, FAILED_LOGIN, PASSWORD_CHANGE, 2FA_ENABLED
   * @param {object} metadata - IP, user agent, reason, etc
   */
  static async logAuthEvent(userId, eventType, metadata = {}) {
    try {
      const query = `
        INSERT INTO auth_audit_logs (
          user_id,
          event_type,
          ip_address,
          user_agent,
          status,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;

      const values = [
        userId,
        eventType,
        metadata.ip_address || null,
        metadata.user_agent || null,
        metadata.status || "SUCCESS",
        JSON.stringify({
          ...metadata,
          timestamp: new Date().toISOString(),
        }),
      ];

      await pool.query(query, values);

      logger.info(`Auth audit: ${eventType} for user ${userId || "unknown"}`);
    } catch (error) {
      logger.error("Auth audit logging failed", { error: error.message });
    }
  }

  /**
   * Log consent management events
   * @param {number} userId - User providing consent
   * @param {string} consentType - MARKETING, DATA_PROCESSING, THIRD_PARTY, etc
   * @param {boolean} granted - Whether consent was granted
   * @param {object} metadata - IP, version of consent form, etc
   */
  static async logConsentEvent(userId, consentType, granted, metadata = {}) {
    try {
      const query = `
        INSERT INTO consent_audit_logs (
          user_id,
          consent_type,
          granted,
          ip_address,
          consent_version,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;

      const values = [
        userId,
        consentType,
        granted,
        metadata.ip_address || null,
        metadata.consent_version || "1.0",
        JSON.stringify({
          ...metadata,
          timestamp: new Date().toISOString(),
        }),
      ];

      await pool.query(query, values);

      logger.info(
        `Consent audit: ${consentType} ${granted ? "GRANTED" : "DECLINED"} by user ${userId}`,
      );
    } catch (error) {
      logger.error("Consent audit logging failed", { error: error.message });
    }
  }

  /**
   * Log data export/access by data subject
   * @param {number} userId - Data subject
   * @param {string} exportType - PERSONAL_DATA_EXPORT, DSAR_RESPONSE, etc
   * @param {object} metadata - What was exported, to whom, etc
   */
  static async logDataExport(userId, exportType, metadata = {}) {
    try {
      const query = `
        INSERT INTO data_export_logs (
          user_id,
          export_type,
          exported_by_user_id,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;

      const values = [
        userId,
        exportType,
        metadata.exported_by_user_id || null,
        JSON.stringify({
          ...metadata,
          timestamp: new Date().toISOString(),
        }),
      ];

      await pool.query(query, values);

      logger.info(`Data export audit: ${exportType} for user ${userId}`);
    } catch (error) {
      logger.error("Data export audit logging failed", {
        error: error.message,
      });
    }
  }

  /**
   * Log data deletion events (hard delete or erasure requests)
   * @param {number} userId - User ID being deleted/erased
   * @param {string} deletionType - HARD_DELETE, GDPR_ERASURE, RETENTION_CLEANUP
   * @param {object} metadata - What was deleted, why, who requested
   */
  static async logDataDeletion(userId, deletionType, metadata = {}) {
    try {
      const query = `
        INSERT INTO deletion_audit_logs (
          user_id,
          deletion_type,
          requested_by_user_id,
          metadata,
          created_at
        ) VALUES ($1, $2, $3, $4, NOW())
        RETURNING *
      `;

      const values = [
        userId,
        deletionType,
        metadata.requested_by_user_id || null,
        JSON.stringify({
          ...metadata,
          timestamp: new Date().toISOString(),
        }),
      ];

      await pool.query(query, values);

      logger.info(`Data deletion audit: ${deletionType} for user ${userId}`);
    } catch (error) {
      logger.error("Data deletion audit logging failed", {
        error: error.message,
      });
    }
  }

  /**
   * Get audit trail for a specific resource
   * @param {string} resource - Resource type
   * @param {number} resourceId - Resource ID
   * @param {number} limit - Number of records to return
   */
  static async getAuditTrail(resource, resourceId, limit = 100) {
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
      logger.error("Failed to retrieve audit trail", { error: error.message });
      return [];
    }
  }

  /**
   * Get audit trail for a specific user
   * @param {number} userId - User ID
   * @param {number} days - Number of days to look back
   * @param {number} limit - Number of records
   */
  static async getUserAuditTrail(userId, days = 30, limit = 500) {
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
        AND created_at >= NOW() - INTERVAL '${days} days'
        ORDER BY created_at DESC
        LIMIT $2
      `;

      const result = await pool.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      logger.error("Failed to retrieve user audit trail", {
        error: error.message,
      });
      return [];
    }
  }
}

module.exports = AuditLogger;
