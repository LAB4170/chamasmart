const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
    createCycle,
    getChamaCycles,
    getCycleRoster,
    processPayout,
    requestPositionSwap,
    respondToSwapRequest,
    getSwapRequests
} = require('../controllers/roscaController');

// All routes are protected and require authentication
router.use(protect);

// Chama cycles
router.route('/chama/:chamaId/cycles')
    .get(authorize('MEMBER'), getChamaCycles)
    .post(authorize('ADMIN', 'TREASURER'), createCycle);

router.delete('/cycles/:cycleId', authorize('ADMIN', 'TREASURER'), require('../controllers/roscaController').deleteCycle);

// Cycle roster
router.get('/cycles/:cycleId/roster', authorize('MEMBER'), getCycleRoster);

// Payouts
router.post('/cycles/:cycleId/payout', authorize('TREASURER'), processPayout);

// Swap requests
router.route('/cycles/:cycleId/swap-request')
    .post(authorize('MEMBER'), requestPositionSwap);

router.route('/swap-requests')
    .get(authorize('MEMBER'), getSwapRequests);

router.put('/swap-requests/:requestId/respond',
    authorize('MEMBER'),
    respondToSwapRequest
);

module.exports = router;
