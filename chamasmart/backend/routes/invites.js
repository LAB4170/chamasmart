const express = require('express');
const router = express.Router();
const {
    generateInvite,
    joinWithInvite,
    getChamaInvites,
    deactivateInvite
} = require('../controllers/inviteController');
const { protect, isOfficial } = require('../middleware/auth');

// Generate invite (Officials only)
router.post('/:chamaId/generate', protect, isOfficial, generateInvite);

// Join with invite code (Any logged-in user)
router.post('/join', protect, joinWithInvite);

// Get chama invites (Officials only)
router.get('/:chamaId', protect, isOfficial, getChamaInvites);

// Deactivate invite (Officials only)
router.delete('/:inviteId', protect, isOfficial, deactivateInvite);

module.exports = router;
