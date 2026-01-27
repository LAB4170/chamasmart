/**
 * Notification Utility Functions
 * Provides unified notification sending capabilities across the application
 */

const logger = require("./logger");
const { logAuditEvent, EVENT_TYPES, SEVERITY } = require("./auditLog");

/**
 * Send notification to user
 * @param {Object} options - Notification options
 * @param {number} options.userId - User ID to send notification to
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {string} options.type - Notification type (info, success, warning, error)
 * @param {Object} options.metadata - Additional metadata
 * @param {string} options.entityType - Entity type for tracking
 * @param {number} options.entityId - Entity ID for tracking
 */
const sendNotification = async (options) => {
  const {
    userId,
    title,
    message,
    type = 'info',
    metadata = {},
    entityType = null,
    entityId = null
  } = options;

  try {
    const pool = require("../config/db");
    
    // Insert notification into database
    const result = await pool.query(
      `INSERT INTO notifications 
       (user_id, title, message, type, metadata, entity_type, entity_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [userId, title, message, type, JSON.stringify(metadata), entityType, entityId]
    );

    const notification = result.rows[0];

    // Log audit event
    await logAuditEvent({
      eventType: EVENT_TYPES.NOTIFICATION_SENT,
      userId: userId,
      action: "Notification sent",
      entityType: entityType || "notification",
      entityId: entityId || notification.notification_id,
      metadata: {
        title,
        type,
        ...metadata
      },
      severity: SEVERITY.LOW
    });

    logger.info(`Notification sent to user ${userId}: ${title}`);

    // Here you could also integrate with other notification channels:
    // - Email notifications
    // - SMS notifications
    // - Push notifications (if mobile app)
    // - WebSocket real-time notifications

    return notification;
  } catch (error) {
    logger.error("Error sending notification:", error);
    throw error;
  }
};

/**
 * Send notification to multiple users
 * @param {Array} userIds - Array of user IDs
 * @param {Object} notificationOptions - Notification options (same as sendNotification)
 */
const sendBulkNotification = async (userIds, notificationOptions) => {
  const results = [];
  
  for (const userId of userIds) {
    try {
      const notification = await sendNotification({
        ...notificationOptions,
        userId
      });
      results.push({ userId, success: true, notification });
    } catch (error) {
      logger.error(`Failed to send notification to user ${userId}:`, error);
      results.push({ userId, success: false, error: error.message });
    }
  }

  return results;
};

/**
 * Send notification to all chama members
 * @param {number} chamaId - Chama ID
 * @param {Object} notificationOptions - Notification options
 * @param {Array} excludeRoles - Roles to exclude (optional)
 */
const sendChamaNotification = async (chamaId, notificationOptions, excludeRoles = []) => {
  try {
    const pool = require("../config/db");
    
    let whereClause = "WHERE m.chama_id = $1 AND m.status = 'active'";
    const params = [chamaId];
    
    if (excludeRoles.length > 0) {
      whereClause += ` AND m.role NOT IN (${excludeRoles.map((_, i) => `$${i + 2}`).join(', ')})`;
      params.push(...excludeRoles);
    }
    
    const result = await pool.query(
      `SELECT m.user_id, u.first_name, u.last_name, u.email
       FROM memberships m
       JOIN users u ON m.user_id = u.user_id
       ${whereClause}`,
      params
    );

    const userIds = result.rows.map(row => row.user_id);
    
    if (userIds.length === 0) {
      logger.warn(`No active members found for chama ${chamaId}`);
      return [];
    }

    return await sendBulkNotification(userIds, {
      ...notificationOptions,
      metadata: {
        ...notificationOptions.metadata,
        chamaId,
        memberCount: userIds.length
      }
    });
  } catch (error) {
    logger.error("Error sending chama notification:", error);
    throw error;
  }
};

/**
 * Send notification to chama officials only
 * @param {number} chamaId - Chama ID
 * @param {Object} notificationOptions - Notification options
 * @param {Array} roles - Specific roles to target (default: all officials)
 */
const sendOfficialNotification = async (chamaId, notificationOptions, roles = ['CHAIRPERSON', 'TREASURER', 'SECRETARY', 'ADMIN']) => {
  try {
    const pool = require("../config/db");
    
    const result = await pool.query(
      `SELECT m.user_id, u.first_name, u.last_name, u.email, m.role
       FROM memberships m
       JOIN users u ON m.user_id = u.user_id
       WHERE m.chama_id = $1 AND m.status = 'active' AND m.role = ANY($2)`,
      [chamaId, roles]
    );

    const userIds = result.rows.map(row => row.user_id);
    
    if (userIds.length === 0) {
      logger.warn(`No officials found for chama ${chamaId}`);
      return [];
    }

    return await sendBulkNotification(userIds, {
      ...notificationOptions,
      metadata: {
        ...notificationOptions.metadata,
        chamaId,
        officialRoles: roles,
        officialCount: userIds.length
      }
    });
  } catch (error) {
    logger.error("Error sending official notification:", error);
    throw error;
  }
};

/**
 * Mark notification as read
 * @param {number} notificationId - Notification ID
 * @param {number} userId - User ID (for verification)
 */
const markNotificationAsRead = async (notificationId, userId) => {
  try {
    const pool = require("../config/db");
    
    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = true, read_at = NOW()
       WHERE notification_id = $1 AND user_id = $2 AND is_read = false
       RETURNING *`,
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error("Notification not found or already read");
    }

    return result.rows[0];
  } catch (error) {
    logger.error("Error marking notification as read:", error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * @param {number} userId - User ID
 */
const markAllNotificationsAsRead = async (userId) => {
  try {
    const pool = require("../config/db");
    
    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = true, read_at = NOW()
       WHERE user_id = $1 AND is_read = false
       RETURNING *`,
      [userId]
    );

    return result.rows;
  } catch (error) {
    logger.error("Error marking all notifications as read:", error);
    throw error;
  }
};

/**
 * Get unread notification count for a user
 * @param {number} userId - User ID
 */
const getUnreadNotificationCount = async (userId) => {
  try {
    const pool = require("../config/db");
    
    const result = await pool.query(
      "SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false",
      [userId]
    );

    return parseInt(result.rows[0].count);
  } catch (error) {
    logger.error("Error getting unread notification count:", error);
    throw error;
  }
};

/**
 * Delete notification
 * @param {number} notificationId - Notification ID
 * @param {number} userId - User ID (for verification)
 */
const deleteNotification = async (notificationId, userId) => {
  try {
    const pool = require("../config/db");
    
    const result = await pool.query(
      "DELETE FROM notifications WHERE notification_id = $1 AND user_id = $2 RETURNING *",
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error("Notification not found");
    }

    return result.rows[0];
  } catch (error) {
    logger.error("Error deleting notification:", error);
    throw error;
  }
};

/**
 * Common notification templates
 */
const notificationTemplates = {
  // Welfare notifications
  welfareClaimSubmitted: (chamaName, claimAmount) => ({
    title: "Welfare Claim Submitted",
    message: `A new welfare claim of KES ${claimAmount} has been submitted for ${chamaName}`,
    type: "info",
    entityType: "welfare_claim"
  }),

  welfareClaimApproved: (chamaName, claimAmount) => ({
    title: "Welfare Claim Approved",
    message: `Your welfare claim of KES ${claimAmount} for ${chamaName} has been approved`,
    type: "success",
    entityType: "welfare_claim"
  }),

  welfareClaimRejected: (chamaName, reason) => ({
    title: "Welfare Claim Rejected",
    message: `Your welfare claim for ${chamaName} has been rejected. Reason: ${reason}`,
    type: "warning",
    entityType: "welfare_claim"
  }),

  // Loan notifications
  loanApplicationReceived: (chamaName, loanAmount) => ({
    title: "Loan Application Received",
    message: `A loan application of KES ${loanAmount} has been received for ${chamaName}`,
    type: "info",
    entityType: "loan"
  }),

  loanApproved: (chamaName, loanAmount) => ({
    title: "Loan Approved",
    message: `Your loan application of KES ${loanAmount} for ${chamaName} has been approved`,
    type: "success",
    entityType: "loan"
  }),

  loanRejected: (chamaName, reason) => ({
    title: "Loan Application Rejected",
    message: `Your loan application for ${chamaName} has been rejected. Reason: ${reason}`,
    type: "warning",
    entityType: "loan"
  }),

  loanPaymentDue: (chamaName, amount, dueDate) => ({
    title: "Loan Payment Due",
    message: `Your loan payment of KES ${amount} for ${chamaName} is due on ${dueDate}`,
    type: "warning",
    entityType: "loan"
  }),

  // Contribution notifications
  contributionReceived: (chamaName, amount) => ({
    title: "Contribution Received",
    message: `Your contribution of KES ${amount} for ${chamaName} has been received`,
    type: "success",
    entityType: "contribution"
  }),

  contributionReminder: (chamaName, amount, dueDate) => ({
    title: "Contribution Reminder",
    message: `Your contribution of KES ${amount} for ${chamaName} is due on ${dueDate}`,
    type: "info",
    entityType: "contribution"
  }),

  // Meeting notifications
  meetingScheduled: (chamaName, meetingTitle, date) => ({
    title: "Meeting Scheduled",
    message: `A meeting "${meetingTitle}" has been scheduled for ${chamaName} on ${date}`,
    type: "info",
    entityType: "meeting"
  }),

  meetingReminder: (chamaName, meetingTitle, date) => ({
    title: "Meeting Reminder",
    message: `Reminder: Meeting "${meetingTitle}" for ${chamaName} is scheduled for ${date}`,
    type: "info",
    entityType: "meeting"
  }),

  // Membership notifications
  joinRequestReceived: (chamaName, memberName) => ({
    title: "New Join Request",
    message: `${memberName} has requested to join ${chamaName}`,
    type: "info",
    entityType: "join_request"
  }),

  membershipApproved: (chamaName) => ({
    title: "Membership Approved",
    message: `Your membership request for ${chamaName} has been approved`,
    type: "success",
    entityType: "membership"
  }),

  membershipRejected: (chamaName, reason) => ({
    title: "Membership Rejected",
    message: `Your membership request for ${chamaName} has been rejected. Reason: ${reason}`,
    type: "warning",
    entityType: "membership"
  })
};

module.exports = {
  sendNotification,
  sendBulkNotification,
  sendChamaNotification,
  sendOfficialNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  deleteNotification,
  notificationTemplates
};
