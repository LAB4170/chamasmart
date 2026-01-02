const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { buyShares, getMyEquity } = require('../controllers/ascaController');
const { createProposal, listProposals, castVote } = require('../controllers/proposalController');
const { listAssets, createAsset } = require('../controllers/assetController');

// All ASCA routes require authentication
router.use(protect);

// Share purchase & equity
router.post('/:chamaId/buy-shares', authorize('MEMBER'), buyShares);
router.get('/:chamaId/equity', authorize('MEMBER'), getMyEquity);

// Proposals (any member can view; officials can create)
router.get('/:chamaId/proposals', authorize('MEMBER'), listProposals);
router.post('/:chamaId/proposals', authorize('ADMIN', 'TREASURER'), createProposal);

// Voting on proposals
router.post('/proposals/:proposalId/vote', authorize('MEMBER'), castVote);

// Assets registry (readable by members; writable by officials)
router.get('/:chamaId/assets', authorize('MEMBER'), listAssets);
router.post('/:chamaId/assets', authorize('ADMIN', 'TREASURER'), createAsset);

module.exports = router;
