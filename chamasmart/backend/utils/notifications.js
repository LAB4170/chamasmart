const pool = require("../config/db");
const { getIo } = require("../socket");

/**
 * Create a notification and emit a socket event
 * @param {Object} params - Notification parameters
 * @param {number} params.userId - Target user ID
 * @param {string} params.type - Notification type
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} params.link - (Optional) UI link
 * @param {number} params.relatedId - (Optional) ID of related entity
 * @returns {Promise<Object>} The created notification
 */
const createNotification = async ({ userId, type, title, message, link, relatedId }) => {
    try {
        const result = await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, link, related_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
            [userId, type, title, message, link, relatedId]
        );

        const notification = result.rows[0];

        // Emit real-time event
        try {
            const io = getIo();
            // Emit to the specific user's socket room
            // We assume users join a room named `user_${userId}` on connection
            io.to(`user_${userId}`).emit("new_notification", notification);
            console.log(`Socket notification emitted to user_${userId}`);
        } catch (socketErr) {
            console.error("Socket notification emit error:", socketErr.message);
        }

        return notification;
    } catch (error) {
        console.error("Create notification error:", error);
        throw error;
    }
};

module.exports = {
    createNotification
};
