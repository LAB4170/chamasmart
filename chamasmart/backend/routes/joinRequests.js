const express = require('express');
const router = express.Router();
const { protect, isOfficial } = require('../middleware/auth');
const {
    requestToJoin,
    getJoinRequests,
    respondToRequest,
    getMyRequests,
} = require('../controllers/joinRequestController');

// User routes
router.post('/:chamaId/request', protect, requestToJoin);
router.get('/my-requests', protect, getMyRequests);

// Official routes
router.get('/:chamaId', protect, isOfficial, getJoinRequests);
router.put('/:requestId/respond', protect, isOfficial, respondToRequest);

module.exports = router;
