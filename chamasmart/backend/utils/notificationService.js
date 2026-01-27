const pool = require('../config/db');
const logger = require('./logger');
const { getIo } = require('../socket');

/**
 * Small helper to insert notifications in a consistent, safe way.
 * Can accept either a dedicated client (inside a transaction) or fall back to the pool.
 */
const getExecutor = client => (client && typeof client.query === 'function' ? client : pool);

/**
 * Create a notification for a single user with socket emission.
 *
 * @param {object|null} client - pg client (inside a transaction) or null to use pool
 * @param {object} options
 * @param {number} options.userId
 * @param {string} options.type
 * @param {string} options.title
 * @param {string} [options.message]
 * @param {string} [options.link]
 * @param {number} [options.relatedId]
 * @param {boolean} [options.emitSocket=true] - Whether to emit socket event
 * @returns {Promise<object|null>} The created notification or null if failed
 */
const createNotification = async (
  client,
  {
    userId, type, title, message, link, relatedId, emitSocket = true,
  },
) => {
  if (!userId || !type || !title) {
    logger.warn('Missing required notification fields', {
      userId,
      type,
      title,
    });
    return null;
  }

  const executor = getExecutor(client);
  let notification = null;

  try {
    const result = await executor.query(
      `INSERT INTO notifications (user_id, type, title, message, link, related_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, type, title, message || null, link || null, relatedId || null],
    );

    notification = result.rows[0];

    // Emit real-time socket event if enabled
    if (emitSocket && notification) {
      try {
        const io = getIo();
        // Emit to the specific user's socket room
        io.to(`user_${userId}`).emit('new_notification', notification);
        logger.debug('Socket notification emitted', {
          userId,
          notificationId: notification.id,
        });
      } catch (socketErr) {
        logger.error('Socket notification emit error', {
          error: socketErr.message,
          userId,
          notificationId: notification?.id,
        });
      }
    }

    return notification;
  } catch (error) {
    logger.logError(error, {
      context: 'createNotification',
      userId,
      type,
    });
    return null;
  }
};

/**
 * Create multiple notifications for different users
 * @param {object|null} client - pg client (inside a transaction) or null to use pool
 * @param {Array} notifications - Array of notification objects
 * @returns {Promise<Array>} Array of created notifications
 */
const createBulkNotifications = async (client, notifications) => {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return [];
  }

  const executor = getExecutor(client);
  const createdNotifications = [];

  try {
    for (const notif of notifications) {
      const result = await createNotification(client, notif);
      if (result) {
        createdNotifications.push(result);
      }
    }
    return createdNotifications;
  } catch (error) {
    logger.logError(error, {
      context: 'createBulkNotifications',
      count: notifications.length,
    });
    return createdNotifications; // Return whatever was created before error
  }
};

/**
 * Get notifications for a user with pagination
 * @param {number} userId - User ID
 * @param {object} options - Query options
 * @returns {Promise<object>} Paginated notifications
 */
const getUserNotifications = async (userId, options = {}) => {
  const {
    page = 1, limit = 20, unreadOnly = false, type = null,
  } = options;

  const offset = (page - 1) * limit;
  let whereClause = 'WHERE user_id = $1';
  const params = [userId];

  if (unreadOnly) {
    whereClause += ' AND read_at IS NULL';
  }

  if (type) {
    whereClause += ` AND type = $${params.length + 1}`;
    params.push(type);
  }

  try {
    const [notificationsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT * FROM notifications ${whereClause} 
         ORDER BY created_at DESC 
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
      pool.query(
        `SELECT COUNT(*) as total FROM notifications ${whereClause}`,
        params,
      ),
    ]);

    return {
      notifications: notificationsResult.rows,
      total: parseInt(countResult.rows[0].total),
      page,
      limit,
      totalPages: Math.ceil(countResult.rows[0].total / limit),
    };
  } catch (error) {
    logger.logError(error, { context: 'getUserNotifications', userId });
    throw error;
  }
};

/**
 * Mark notification as read
 * @param {number} notificationId - Notification ID
 * @param {number} userId - User ID (for security)
 * @returns {Promise<boolean>} Success status
 */
const markAsRead = async (notificationId, userId) => {
  try {
    const result = await pool.query(
      'UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2',
      [notificationId, userId],
    );

    return result.rowCount > 0;
  } catch (error) {
    logger.logError(error, { context: 'markAsRead', notificationId, userId });
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * @param {number} userId - User ID
 * @returns {Promise<number>} Number of updated notifications
 */
const markAllAsRead = async userId => {
  try {
    const result = await pool.query(
      'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
      [userId],
    );

    return result.rowCount;
  } catch (error) {
    logger.logError(error, { context: 'markAllAsRead', userId });
    throw error;
  }
};

/**
 * Get unread notification count for a user
 * @param {number} userId - User ID
 * @returns {Promise<number>} Unread count
 */
const getUnreadCount = async userId => {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [userId],
    );

    return parseInt(result.rows[0].count);
  } catch (error) {
    logger.logError(error, { context: 'getUnreadCount', userId });
    throw error;
  }
};

module.exports = {
  createNotification,
  createBulkNotifications,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  // Legacy export for backward compatibility
  sendNotification: createNotification,
};
