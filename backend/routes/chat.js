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

// Send message to a channel
// POST /api/chat/channels/:channelId/messages
router.post('/channels/:channelId/messages', protect, chatController.sendMessage);

module.exports = router;
