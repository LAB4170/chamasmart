const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

// Note: Mounted at /api/chat

// Get channels for a chama
// GET /api/chat/chamas/:chamaId/channels
router.get('/chamas/:chamaId/channels', protect, chatController.getChannels);

// Get messages for a channel
// GET /api/chat/channels/:channelId/messages
router.get('/channels/:channelId/messages', protect, chatController.getMessages);

// Send message to a channel (Member group chat)
// POST /api/chat/channels/:channelId/messages
router.post('/channels/:channelId/messages', protect, chatController.sendMessage);

// Global AI Support Bot endpoint (used by the floating widget — NOT the group chat)
// POST /api/chat/ai-support
router.post('/ai-support', protect, chatController.aiSupportChat);

module.exports = router;

