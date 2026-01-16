/**
 * Token Management Utilities
 * Handles access tokens and refresh tokens for authentication
 */

const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const logger = require("./logger");

/**
 * Generate access token (short-lived, 7 days)
 * @param {number} userId - User ID
 * @returns {string} - Access token
 */
const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId, type: "access" }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

/**
 * Generate refresh token (long-lived, 30 days)
 * @param {number} userId - User ID
 * @returns {string} - Refresh token
 */
const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId, type: "refresh" }, process.env.JWT_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRE || "30d",
  });
};

/**
 * Store refresh token in database
 * @param {number} userId - User ID
 * @param {string} token - Refresh token
 * @param {string} userAgent - User agent from request
 * @param {string} ipAddress - IP address from request
 * @returns {Promise<Object>} - Token record
 */
const storeRefreshToken = async (userId, token, userAgent, ipAddress) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const expiresAt = new Date(decoded.exp * 1000); // Convert to milliseconds

    const result = await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, user_agent, ip_address, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [userId, token, userAgent, ipAddress, expiresAt]
    );

    return result.rows[0];
  } catch (error) {
    logger.error("Failed to store refresh token", {
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
    // Verify JWT signature
    jwt.verify(token, process.env.JWT_SECRET);

    // Check if token exists in database and is not revoked
    const result = await pool.query(
      `SELECT * FROM refresh_tokens 
       WHERE user_id = $1 AND token = $2 AND expires_at > NOW() AND revoked_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, token]
    );

    if (result.rows.length === 0) {
      throw new Error("Refresh token not found or expired");
    }

    return result.rows[0];
  } catch (error) {
    logger.warn("Invalid refresh token", { userId, error: error.message });
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
      [userId, token]
    );
  } catch (error) {
    logger.error("Failed to revoke refresh token", {
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
const revokeAllRefreshTokens = async (userId) => {
  try {
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  } catch (error) {
    logger.error("Failed to revoke all refresh tokens", {
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
      `DELETE FROM refresh_tokens WHERE expires_at < NOW()`
    );
    logger.info("Cleaned up expired refresh tokens", {
      count: result.rowCount,
    });
    return result.rowCount;
  } catch (error) {
    logger.error("Failed to cleanup expired tokens", { error: error.message });
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
};
