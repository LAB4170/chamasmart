const express = require('express');

const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { buyShares, getMyEquity } = require('../controllers/ascaController');
const {
  createProposal,
  listProposals,
  castVote,
} = require('../controllers/proposalController');
const { listAssets, createAsset } = require('../controllers/assetController');
const validate = require('../middleware/validate');
const {
  buySharesSchema,
  createProposalSchema,
  castVoteSchema,
  createAssetSchema,
} = require('../utils/validationSchemas');
const { applyFinancialRateLimiting } = require('../middleware/rateLimiting');

// All ASCA routes require authentication
router.use(protect);

// ============================================================================
// SHARE PURCHASE & EQUITY MANAGEMENT
// ============================================================================

// Buy shares (with rate limiting for financial transactions)
router.post(
  '/:chamaId/buy-shares',
  authorize('member', 'admin', 'treasurer'),
  applyFinancialRateLimiting,
  validate(buySharesSchema),
  buyShares,
);

// Get member's equity
router.get(
  '/:chamaId/equity',
  authorize('member', 'admin', 'treasurer'),
  getMyEquity,
);

// ============================================================================
// PROPOSALS & VOTING
// ============================================================================

// List all proposals for a chama
router.get(
  '/:chamaId/proposals',
  authorize('member', 'admin', 'treasurer', 'chairperson'),
  listProposals,
);

// Create new proposal (officials only)
router.post(
  '/:chamaId/proposals',
  authorize('admin', 'treasurer', 'chairperson'),
  validate(createProposalSchema),
  createProposal,
);

// Vote on a proposal (includes chamaId for better context)
router.post(
  '/:chamaId/proposals/:proposalId/vote',
  authorize('member', 'admin', 'treasurer', 'chairperson'),
  validate(castVoteSchema),
  castVote,
);

// ============================================================================
// ASSET REGISTRY
// ============================================================================

// List chama assets (all members can view)
router.get(
  '/:chamaId/assets',
  authorize('member', 'admin', 'treasurer', 'chairperson'),
  listAssets,
);

// Create/register new asset (officials only)
router.post(
  '/:chamaId/assets',
  authorize('admin', 'treasurer', 'chairperson'),
  validate(createAssetSchema),
  createAsset,
);

module.exports = router;
