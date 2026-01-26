/**
 * API Key Management Routes
 * Handles creation, listing, and management of API keys
 */

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const {
  createAPIKey,
  listAPIKeys,
  revokeAPIKey,
  deleteAPIKey,
  rotateAPIKey,
  requireScope,
} = require("../middleware/apiKey");

// Apply authentication to all routes
router.use(protect);

// Create a new API key
router.post("/", requireScope("api_keys:write"), asyncHandler(createAPIKey));

// List all API keys for the authenticated user
router.get("/", requireScope("api_keys:read"), asyncHandler(listAPIKeys));

// Revoke an API key (soft delete)
router.post(
  "/:keyId/revoke",
  requireScope("api_keys:write"),
  asyncHandler(revokeAPIKey),
);

// Delete an API key (permanent)
router.delete(
  "/:keyId",
  requireScope("api_keys:write"),
  asyncHandler(deleteAPIKey),
);

// Rotate an API key (generate a new key value)
router.post(
  "/:keyId/rotate",
  requireScope("api_keys:write"),
  asyncHandler(rotateAPIKey),
);

module.exports = router;
