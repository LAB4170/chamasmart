/**
 * Token Management Utilities
 * Handles access tokens and refresh tokens for authentication
 * Enhanced with key versioning and token hashing for security
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const logger = require('./logger');
const { getKeyManager } = require('../security/keyManagement');

/**
 * Hash refresh token before storage (SHA-256)
 * @param {string} token - The raw refresh token
 * @returns {string} SHA-256 hash of token
 */
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Verify token against its hash
 * @param {string} token - The raw token to verify
 * @param {string} hash - The stored hash
 * @returns {boolean} True if token matches hash
 */
const verifyTokenHash = (token, hash) => {
  const computedHash = hashToken(token);
  return computedHash === hash;
};

/**
 * Generate access token (short-lived, 7 days) with key versioning
 * @param {number} userId - User ID
 * @returns {string} - Access token
 */
const generateAccessToken = userId => {
  const keyManager = getKeyManager();
  return jwt.sign({ id: userId, type: 'access' }, keyManager.getActiveKey(), {
    expiresIn: process.env.JWT_EXPIRE || '7d',
    keyid: keyManager.getActiveKeyVersion().toString(),
  });
};

/**
 * Generate refresh token (long-lived, 30 days) with key versioning
 * @param {number} userId - User ID
 * @returns {string} - Refresh token
 */
const generateRefreshToken = userId => {
  const keyManager = getKeyManager();
  return jwt.sign({ id: userId, type: 'refresh' }, keyManager.getActiveKey(), {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRE || '30d',
    keyid: keyManager.getActiveKeyVersion().toString(),
  });
};

/**
 * Store refresh token in database with hashing
 * @param {number} userId - User ID
 * @param {string} token - Refresh token
 * @param {string} userAgent - User agent from request
 * @param {string} ipAddress - IP address from request
 * @returns {Promise<Object>} - Token record
 */
const storeRefreshToken = async (userId, token, userAgent, ipAddress) => {
  try {
    const keyManager = getKeyManager();
    const decoded = jwt.verify(token, keyManager.getActiveKey());
    const expiresAt = new Date(decoded.exp * 1000); // Convert to milliseconds
    const hashedToken = hashToken(token);

    const result = await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, user_agent, ip_address, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [userId, hashedToken, userAgent, ipAddress, expiresAt],
    );

    logger.info('Refresh token stored (hashed)', { userId });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to store refresh token', {
      userId,
      error: error.message,
    });
    throw error;
  }
};

/**
 * Verify and retrieve refresh token from database
 * @param {number} userId - User ID
 * @param {string} token - Refresh token to verify
 * @returns {Promise<Object>} - Token record if valid
 */
const verifyRefreshToken = async (userId, token) => {
  try {
    const keyManager = getKeyManager();
    const hashedToken = hashToken(token);

    // Try to verify with all available keys (for rotation support)
    let decoded = null;
    let verificationError = null;

    // Try active key first
    try {
      decoded = jwt.verify(token, keyManager.getActiveKey());
    } catch (err) {
      verificationError = err;
    }

    // If active key fails, try previous versions (rotation period)
    if (!decoded) {
      const allVersions = Object.keys(keyManager.keys);
      for (const version of allVersions) {
        try {
          const key = keyManager.getKeyForVerification(version);
          if (key) {
            decoded = jwt.verify(token, key);
            logger.warn('Token verified with previous key version', {
              userId,
              version,
            });
            break;
          }
        } catch (err) {
          // Continue to next version
        }
      }
    }

    if (!decoded) {
      throw verificationError || new Error('Token verification failed');
    }

    // Check if token exists in database with matching hash
    const result = await pool.query(
      `SELECT * FROM refresh_tokens 
       WHERE user_id = $1 AND token = $2 AND expires_at > NOW() AND revoked_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, hashedToken],
    );

    if (result.rows.length === 0) {
      throw new Error('Refresh token not found, expired, or revoked');
    }

    logger.info('Refresh token verified successfully', { userId });
    return result.rows[0];
  } catch (error) {
    logger.warn('Invalid refresh token', { userId, error: error.message });
    throw error;
  }
};

/**
 * Revoke a refresh token
 * @param {number} userId - User ID
 * @param {string} token - Refresh token to revoke
 * @returns {Promise<void>}
 */
const revokeRefreshToken = async (userId, token) => {
  try {
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND token = $2`,
      [userId, token],
    );
  } catch (error) {
    logger.error('Failed to revoke refresh token', {
      userId,
      error: error.message,
    });
  }
};

/**
 * Revoke all refresh tokens for a user (on logout)
 * @param {number} userId - User ID
 * @returns {Promise<void>}
 */
const revokeAllRefreshTokens = async userId => {
  try {
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  } catch (error) {
    logger.error('Failed to revoke all refresh tokens', {
      userId,
      error: error.message,
    });
  }
};

/**
 * Clean up expired refresh tokens (runs periodically)
 * @returns {Promise<number>} - Number of deleted tokens
 */
const cleanupExpiredTokens = async () => {
  try {
    const result = await pool.query(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW()',
    );
    logger.info('Cleaned up expired refresh tokens', {
      count: result.rowCount,
    });
    return result.rowCount;
  } catch (error) {
    logger.error('Failed to cleanup expired tokens', { error: error.message });
    return 0;
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  cleanupExpiredTokens,
  hashToken,
  verifyTokenHash,
};
