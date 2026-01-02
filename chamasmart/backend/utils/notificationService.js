const pool = require('../config/db');
const logger = require('./logger');

/**
 * Small helper to insert notifications in a consistent, safe way.
 * Can accept either a dedicated client (inside a transaction) or fall back to the pool.
 */
const getExecutor = (client) => (client && typeof client.query === 'function' ? client : pool);

/**
 * Create a notification for a single user.
 *
 * @param {object|null} client - pg client (inside a transaction) or null to use pool
 * @param {object} options
 * @param {number} options.userId
 * @param {string} options.type
 * @param {string} options.title
 * @param {string} [options.message]
 * @param {string} [options.link]
 * @param {number} [options.relatedId]
 */
const createNotification = async (client, { userId, type, title, message, link, relatedId }) => {
  if (!userId || !type || !title) {
    return;
  }

  const executor = getExecutor(client);

  try {
    await executor.query(
      `INSERT INTO notifications (user_id, type, title, message, link, related_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, type, title, message || null, link || null, relatedId || null]
    );
  } catch (error) {
    // Do not throw from notifications to avoid impacting core flows.
    logger.logError(error, {
      context: 'createNotification',
      userId,
      type,
    });
  }
};

module.exports = {
  createNotification,
};
