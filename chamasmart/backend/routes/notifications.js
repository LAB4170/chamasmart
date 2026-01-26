const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
} = require("../controllers/notificationController");
const { applyRateLimiting } = require("../middleware/rateLimiting");

// ============================================================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================================================

router.use(protect);

// ============================================================================
// NOTIFICATION RETRIEVAL
// ============================================================================

// Get user's notifications (supports pagination via query params)
router.get("/", getNotifications);

// Get count of unread notifications
router.get("/unread-count", getUnreadCount);

// ============================================================================
// NOTIFICATION ACTIONS
// ============================================================================

// Mark specific notification as read
router.put("/:id/read", markAsRead);

// Mark all notifications as read (with rate limiting)
router.put("/read-all", applyRateLimiting, markAllAsRead);

// Delete specific notification
router.delete("/:id", deleteNotification);

// Delete all read notifications (with rate limiting)
router.delete("/read/all", applyRateLimiting, deleteAllRead);

module.exports = router;
