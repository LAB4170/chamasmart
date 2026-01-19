/**
 * API Key Authentication & Management
 * Secure API key generation, validation, and rotation
 */

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const logger = require("../utils/logger");

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a secure API key
 * Format: chama_live_[uuid]_[random_16chars]
 */
function generateAPIKey() {
  const prefix =
    process.env.NODE_ENV === "production" ? "chama_live" : "chama_test";
  const uuid = crypto.randomUUID();
  const randomPart = crypto.randomBytes(16).toString("hex").slice(0, 16);

  return `${prefix}_${uuid}_${randomPart}`;
}

/**
 * Hash API key for storage
 */
async function hashAPIKey(apiKey) {
  return bcrypt.hash(apiKey, 10);
}

/**
 * Verify API key against hash
 */
async function verifyAPIKey(plainKey, hashedKey) {
  return bcrypt.compare(plainKey, hashedKey);
}

/**
 * Extract and validate API key from request
 */
function extractAPIKey(req) {
  // Check Authorization header first (preferred)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Check X-API-Key header
  if (req.headers["x-api-key"]) {
    return req.headers["x-api-key"];
  }

  // Check query parameter (less secure, for webhooks)
  if (req.query.apiKey) {
    return req.query.apiKey;
  }

  return null;
}

// ============================================================================
// CREATE API KEY ENDPOINT
// ============================================================================

const createAPIKey = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    const { name, expiresInDays = 365 } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "API key name is required and must be a non-empty string",
      });
    }

    // Generate API key
    const plainKey = generateAPIKey();
    const hashedKey = await hashAPIKey(plainKey);

    // Calculate expiry date
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiresInDays);

    // Store in database
    const result = await pool.query(
      `INSERT INTO api_keys (user_id, name, key_hash, key_prefix, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING key_id, name, key_prefix, expires_at, created_at`,
      [
        userId,
        name,
        hashedKey,
        plainKey.slice(0, 20), // Store prefix for display
        expiryDate,
      ],
    );

    const apiKeyRecord = result.rows[0];

    logger.info("✅ API key created", {
      userId,
      keyId: apiKeyRecord.key_id,
      name,
      expiresAt: expiryDate,
    });

    res.status(201).json({
      success: true,
      message: "API key created successfully",
      data: {
        keyId: apiKeyRecord.key_id,
        name: apiKeyRecord.name,
        apiKey: plainKey, // Only shown once
        keyPrefix: apiKeyRecord.key_prefix,
        expiresAt: apiKeyRecord.expires_at,
        createdAt: apiKeyRecord.created_at,
        warning: "Save your API key now. You will not be able to see it again.",
      },
    });
  } catch (error) {
    logger.error("Create API key error", error);
    next(error);
  }
};

// ============================================================================
// LIST API KEYS ENDPOINT
// ============================================================================

const listAPIKeys = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const result = await pool.query(
      `SELECT key_id, name, key_prefix, expires_at, last_used_at, created_at, is_active
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    res.json({
      success: true,
      data: {
        keys: result.rows,
        total: result.rows.length,
      },
    });
  } catch (error) {
    logger.error("List API keys error", error);
    next(error);
  }
};

// ============================================================================
// REVOKE API KEY ENDPOINT
// ============================================================================

const revokeAPIKey = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    const { keyId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!keyId) {
      return res.status(400).json({
        success: false,
        message: "Key ID is required",
      });
    }

    // Verify ownership and revoke
    const result = await pool.query(
      `UPDATE api_keys
       SET is_active = false, revoked_at = NOW()
       WHERE key_id = $1 AND user_id = $2
       RETURNING key_id, name`,
      [keyId, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "API key not found or does not belong to this user",
      });
    }

    logger.info("✅ API key revoked", {
      userId,
      keyId,
      name: result.rows[0].name,
    });

    res.json({
      success: true,
      message: "API key revoked successfully",
    });
  } catch (error) {
    logger.error("Revoke API key error", error);
    next(error);
  }
};

// ============================================================================
// DELETE API KEY ENDPOINT
// ============================================================================

const deleteAPIKey = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    const { keyId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!keyId) {
      return res.status(400).json({
        success: false,
        message: "Key ID is required",
      });
    }

    // Verify ownership and delete
    const result = await pool.query(
      `DELETE FROM api_keys
       WHERE key_id = $1 AND user_id = $2
       RETURNING key_id, name`,
      [keyId, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "API key not found or does not belong to this user",
      });
    }

    logger.info("✅ API key deleted", {
      userId,
      keyId,
      name: result.rows[0].name,
    });

    res.json({
      success: true,
      message: "API key deleted successfully",
    });
  } catch (error) {
    logger.error("Delete API key error", error);
    next(error);
  }
};

// ============================================================================
// API KEY AUTHENTICATION MIDDLEWARE
// ============================================================================

const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = extractAPIKey(req);

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message:
          "API key is required. Provide in Authorization header: Bearer <api_key>",
      });
    }

    // Extract key prefix for faster lookup
    const keyPrefix = apiKey.slice(0, 20);

    // Query database for matching key
    const result = await pool.query(
      `SELECT ak.key_id, ak.user_id, ak.key_hash, ak.is_active, ak.expires_at, u.email, u.role
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.user_id
       WHERE ak.key_prefix = $1 AND ak.is_active = true
       LIMIT 1`,
      [keyPrefix],
    );

    if (result.rows.length === 0) {
      logger.warn("⚠️ Invalid API key attempted", {
        keyPrefix,
        ip: req.ip,
      });

      return res.status(401).json({
        success: false,
        message: "Invalid API key",
      });
    }

    const keyRecord = result.rows[0];

    // Check expiry
    if (new Date(keyRecord.expires_at) < new Date()) {
      logger.warn("⚠️ Expired API key used", {
        keyId: keyRecord.key_id,
        userId: keyRecord.user_id,
      });

      return res.status(401).json({
        success: false,
        message: "API key has expired",
      });
    }

    // Verify key hash
    const isValid = await verifyAPIKey(apiKey, keyRecord.key_hash);

    if (!isValid) {
      logger.warn("⚠️ Invalid API key hash", {
        keyPrefix,
        ip: req.ip,
      });

      return res.status(401).json({
        success: false,
        message: "Invalid API key",
      });
    }

    // Update last used timestamp
    pool
      .query("UPDATE api_keys SET last_used_at = NOW() WHERE key_id = $1", [
        keyRecord.key_id,
      ])
      .catch((err) => logger.error("Failed to update last_used_at", err));

    // Attach user info to request
    req.user = {
      userId: keyRecord.user_id,
      email: keyRecord.email,
      role: keyRecord.role,
      authenticatedVia: "api-key",
      apiKeyId: keyRecord.key_id,
    };

    // Log access
    logger.info("✅ API key authenticated", {
      userId: keyRecord.user_id,
      keyId: keyRecord.key_id,
      endpoint: req.path,
    });

    next();
  } catch (error) {
    logger.error("API key authentication error", error);
    res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

// ============================================================================
// MIDDLEWARE EXPORT
// ============================================================================

module.exports = {
  generateAPIKey,
  hashAPIKey,
  verifyAPIKey,
  extractAPIKey,
  createAPIKey,
  listAPIKeys,
  revokeAPIKey,
  deleteAPIKey,
  apiKeyAuth,
};
