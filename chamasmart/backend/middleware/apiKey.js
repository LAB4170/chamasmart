/**
 * API Key Management Middleware
 * Handles API key generation, validation, and management
 */

const crypto = require('crypto');
const { promisify } = require('util');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const logger = require('../utils/logger');
const { HTTP_STATUS, ERROR_CODES } = require('./constants');
const {
  APIError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} = require('./errorHandler');
const { executeDatabaseOperation } = require('./circuitBreaker');

// Promisify bcrypt functions
const hash = promisify(bcrypt.hash);
const compare = promisify(bcrypt.compare);

// Generate a random API key
const generateAPIKey = () => {
  const apiKey = `chama_${crypto.randomBytes(32).toString('hex')}`;
  const prefix = apiKey.substring(0, 20);
  return { apiKey, prefix };
};

// Hash API key for secure storage
const hashAPIKey = async apiKey => {
  try {
    return await hash(apiKey, 10);
  } catch (error) {
    logger.error('Error hashing API key', { error: error.message });
    throw new Error('Failed to hash API key');
  }
};

// Verify API key against hash
const verifyAPIKey = async (apiKey, hash) => {
  try {
    return await compare(apiKey, hash);
  } catch (error) {
    logger.error('Error verifying API key', { error: error.message });
    return false;
  }
};

// Extract API key from request
const extractAPIKey = req => {
  const authHeader = req.headers.authorization || '';
  const apiKey = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;

  // If not in header, check query parameters
  return apiKey || req.query.apiKey || null;
};

// Check if user has reached API key limit
const checkApiKeyLimit = async userId => {
  const config = require('../config/middleware.config');

  const result = await executeDatabaseOperation(
    'SELECT COUNT(*) FROM api_keys WHERE user_id = $1',
    [userId],
  );

  const keyCount = parseInt(result.rows[0].count, 10);

  if (keyCount >= config.auth.maxApiKeysPerUser) {
    throw new ValidationError(
      `Maximum number of API keys (${config.auth.maxApiKeysPerUser}) reached`,
    );
  }
};

// Create a new API key
const createAPIKey = async (req, res) => {
  const userId = req.user?.userId || req.user?.user_id;
  const {
    name = 'My API Key',
    expiresInDays = 365,
    scopes = ['read', 'write'], // Default scopes
  } = req.body;

  if (!userId) {
    throw new AuthenticationError('Authentication required');
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError(
      'API key name is required and must be a non-empty string',
    );
  }

  if (!Array.isArray(scopes) || scopes.length === 0) {
    throw new ValidationError('At least one scope is required');
  }

  // Check API key limit
  await checkApiKeyLimit(userId);

  // Generate API key
  const { apiKey, prefix } = generateAPIKey();
  const hashedKey = await hashAPIKey(apiKey);

  // Calculate expiry date
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + expiresInDays);

  // Store in database
  const result = await executeDatabaseOperation(
    `INSERT INTO api_keys (user_id, name, key_hash, key_prefix, scopes, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING key_id, name, key_prefix, scopes, expires_at, created_at`,
    [
      userId,
      name.trim(),
      hashedKey,
      prefix,
      JSON.stringify(scopes),
      expiryDate,
    ],
  );

  const apiKeyRecord = result.rows[0];

  logger.info('✅ API key created', {
    userId,
    keyId: apiKeyRecord.key_id,
    name,
    scopes,
    expiresAt: expiryDate,
  });

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: 'API key created successfully',
    data: {
      keyId: apiKeyRecord.key_id,
      name: apiKeyRecord.name,
      apiKey, // Only shown once
      keyPrefix: apiKeyRecord.key_prefix,
      scopes: JSON.parse(apiKeyRecord.scopes),
      expiresAt: apiKeyRecord.expires_at,
      createdAt: apiKeyRecord.created_at,
      warning: 'Save your API key now. You will not be able to see it again.',
    },
  });
};

// List all API keys for a user
const listAPIKeys = async (req, res) => {
  const userId = req.user?.userId || req.user?.user_id;

  if (!userId) {
    throw new AuthenticationError('Authentication required');
  }

  const result = await executeDatabaseOperation(
    `SELECT key_id, name, key_prefix, scopes, expires_at, last_used_at, created_at, is_active
     FROM api_keys
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );

  const keys = result.rows.map(key => ({
    ...key,
    scopes: JSON.parse(key.scopes || '[]'),
  }));

  res.json({
    success: true,
    data: {
      keys,
      total: keys.length,
    },
  });
};

// Revoke an API key
const revokeAPIKey = async (req, res) => {
  const userId = req.user?.userId || req.user?.user_id;
  const { keyId } = req.params;

  if (!userId) {
    throw new AuthenticationError('Authentication required');
  }

  if (!keyId) {
    throw new ValidationError('Key ID is required');
  }

  // Verify ownership and revoke
  const result = await executeDatabaseOperation(
    `UPDATE api_keys
     SET is_active = false, revoked_at = NOW()
     WHERE key_id = $1 AND user_id = $2
     RETURNING key_id, name`,
    [keyId, userId],
  );

  if (result.rows.length === 0) {
    throw new NotFoundError(
      'API key not found or does not belong to this user',
    );
  }

  logger.info('✅ API key revoked', {
    userId,
    keyId,
    name: result.rows[0].name,
  });

  res.json({
    success: true,
    message: 'API key revoked successfully',
  });
};

// Delete an API key
const deleteAPIKey = async (req, res) => {
  const userId = req.user?.userId || req.user?.user_id;
  const { keyId } = req.params;

  if (!userId) {
    throw new AuthenticationError('Authentication required');
  }

  if (!keyId) {
    throw new ValidationError('Key ID is required');
  }

  // Verify ownership and delete
  const result = await executeDatabaseOperation(
    `DELETE FROM api_keys
     WHERE key_id = $1 AND user_id = $2
     RETURNING key_id, name`,
    [keyId, userId],
  );

  if (result.rows.length === 0) {
    throw new NotFoundError(
      'API key not found or does not belong to this user',
    );
  }

  logger.info('✅ API key deleted', {
    userId,
    keyId,
    name: result.rows[0].name,
  });

  res.json({
    success: true,
    message: 'API key deleted successfully',
  });
};

// Rotate an API key
const rotateAPIKey = async (req, res) => {
  const userId = req.user?.userId || req.user?.user_id;
  const { keyId } = req.params;

  if (!userId) {
    throw new AuthenticationError('Authentication required');
  }

  // Get existing key
  const existing = await executeDatabaseOperation(
    'SELECT * FROM api_keys WHERE key_id = $1 AND user_id = $2',
    [keyId, userId],
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError('API key not found');
  }

  const oldKey = existing.rows[0];

  // Generate new key
  const { apiKey, prefix } = generateAPIKey();
  const hashedKey = await hashAPIKey(apiKey);

  // Update key
  const result = await executeDatabaseOperation(
    `UPDATE api_keys
     SET key_hash = $1, key_prefix = $2, last_rotated_at = NOW()
     WHERE key_id = $3
     RETURNING key_id, name, key_prefix, scopes, expires_at`,
    [hashedKey, prefix, keyId],
  );

  logger.info('✅ API key rotated', {
    userId,
    keyId,
    name: oldKey.name,
  });

  res.json({
    success: true,
    message: 'API key rotated successfully',
    data: {
      keyId: result.rows[0].key_id,
      name: result.rows[0].name,
      apiKey,
      keyPrefix: result.rows[0].key_prefix,
      scopes: JSON.parse(result.rows[0].scopes),
      expiresAt: result.rows[0].expires_at,
      warning: 'Save your new API key. The old one is now invalid.',
    },
  });
};

// API Key Authentication Middleware
const apiKeyAuth = async (req, res, next) => {
  const apiKey = extractAPIKey(req);

  if (!apiKey) {
    throw new AuthenticationError(
      'API key is required. Provide in Authorization header: Bearer <api_key>',
    );
  }

  // Extract key prefix for faster lookup
  const keyPrefix = apiKey.slice(0, 20);

  // Query database for matching key
  const result = await executeDatabaseOperation(
    `SELECT ak.key_id, ak.user_id, ak.key_hash, ak.scopes, ak.is_active, ak.expires_at, 
            u.email, u.role, u.tier
     FROM api_keys ak
     JOIN users u ON ak.user_id = u.user_id
     WHERE ak.key_prefix = $1 AND ak.is_active = true
     LIMIT 1`,
    [keyPrefix],
  );

  if (result.rows.length === 0) {
    logger.warn('⚠️ Invalid API key attempted', {
      keyPrefix,
      ip: req.ip,
    });

    throw new AuthenticationError('Invalid API key');
  }

  const keyRecord = result.rows[0];

  // Check expiry
  if (new Date(keyRecord.expires_at) < new Date()) {
    logger.warn('⚠️ Expired API key used', {
      keyId: keyRecord.key_id,
      userId: keyRecord.user_id,
    });

    throw new AuthenticationError('API key has expired');
  }

  // Verify key hash
  const isValid = await verifyAPIKey(apiKey, keyRecord.key_hash);

  if (!isValid) {
    logger.warn('⚠️ Invalid API key hash', {
      keyPrefix,
      ip: req.ip,
    });

    throw new AuthenticationError('Invalid API key');
  }

  // Update last used timestamp (async, don't await)
  executeDatabaseOperation(
    'UPDATE api_keys SET last_used_at = NOW() WHERE key_id = $1',
    [keyRecord.key_id],
  ).catch(err => logger.error('Failed to update last_used_at', err));

  // Attach user info to request
  req.user = {
    userId: keyRecord.user_id,
    user_id: keyRecord.user_id, // Alias
    email: keyRecord.email,
    role: keyRecord.role,
    tier: keyRecord.tier || 'free',
    authenticatedVia: 'api-key',
    apiKeyId: keyRecord.key_id,
    scopes: JSON.parse(keyRecord.scopes || '[]'),
  };

  // Log access
  logger.info('✅ API key authenticated', {
    userId: keyRecord.user_id,
    keyId: keyRecord.key_id,
    endpoint: req.path,
  });

  next();
};

/**
 * Scope validation middleware
 * Checks if API key has required scope
 */
const requireScope = (...requiredScopes) => (req, res, next) => {
  if (!req.user?.scopes) {
    throw new AuthorizationError('No scopes available');
  }

  const hasScope = requiredScopes.some(scope => req.user.scopes.includes(scope));

  if (!hasScope) {
    throw new AuthorizationError(
      `Required scope(s): ${requiredScopes.join(', ')}`,
    );
  }

  next();
};

module.exports = {
  generateAPIKey,
  hashAPIKey,
  verifyAPIKey,
  extractAPIKey,
  createAPIKey,
  listAPIKeys,
  revokeAPIKey,
  deleteAPIKey,
  rotateAPIKey,
  apiKeyAuth,
  requireScope,
};
