/**
 * Error Prevention and Debugging Guide
 *
 * Common 500 errors and their solutions
 */

// ISSUE 1: Notifications table might not exist yet
// SOLUTION: Add error handling for missing tables

const pool = require('../config/db');

// @desc    Get user's notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { limit = 20 } = req.query;

    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit],
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });

    // Check if table doesn't exist
    if (error.code === '42P01') {
      return res.status(500).json({
        success: false,
        message: 'Notifications table not found. Please run database migration.',
        error: 'TABLE_NOT_FOUND',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
    });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId],
    );

    res.json({
      success: true,
      count: parseInt(result.rows[0].count),
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });

    // Check if table doesn't exist
    if (error.code === '42P01') {
      return res.status(200).json({
        success: true,
        count: 0, // Return 0 instead of error to prevent UI breaking
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error fetching unread count',
    });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;

    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = true 
       WHERE notification_id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });

    res.status(500).json({
      success: false,
      message: 'Error marking notification as read',
    });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.user_id;

    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [userId],
    );

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });

    res.status(500).json({
      success: false,
      message: 'Error marking all notifications as read',
    });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
