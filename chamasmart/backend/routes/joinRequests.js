const express = require('express');
const router = express.Router();
const { protect, isOfficial } = require('../middleware/auth');
const {
    requestToJoin,
    getJoinRequests,
    respondToRequest,
    getMyRequests,
} = require('../controllers/joinRequestController');

const validate = require('../middleware/validate');
const { requestToJoinSchema, respondToJoinRequestSchema } = require('../utils/validationSchemas');

// IMPORTANT: Specific routes MUST come BEFORE parameterized routes
// /my-requests must come before /:chamaId to prevent route shadowing

// User's specific routes (FIRST - most specific)
router.get('/my-requests', protect, getMyRequests);
router.put('/:requestId/respond', protect, validate(respondToJoinRequestSchema), respondToRequest);

// Chama-specific routes (parameterized)
router.post('/:chamaId/request', protect, validate(requestToJoinSchema), requestToJoin);

// Official routes
router.get('/:chamaId', protect, isOfficial, getJoinRequests);

module.exports = router;
