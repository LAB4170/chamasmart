/**
 * FAST-TRACK INTEGRATION: Token Manager with Hashing
 * File: backend/utils/tokenManager.js - ADD THESE FUNCTIONS
 * 
 * Copy these functions into your existing tokenManager.js file
 */

const crypto = require('crypto');

/**
 * Hash refresh token before storage (SHA-256)
 * @param {string} token - The raw refresh token
 * @returns {string} SHA-256 hash of token
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

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
 * INTEGRATION POINTS - Update these in your existing code:
 * 
 * 1. In storeRefreshToken function:
 *    OLD: await pool.query("INSERT INTO refresh_tokens (user_id, token, ...) VALUES ($1, $2, ...)", [userId, refreshToken, ...]);
 *    NEW: const hashedToken = hashToken(refreshToken);
 *         await pool.query("INSERT INTO refresh_tokens (user_id, token, ...) VALUES ($1, $2, ...)", [userId, hashedToken, ...]);
 * 
 * 2. In verifyRefreshToken function:
 *    OLD: if (dbToken === refreshToken) { ... }
 *    NEW: if (verifyTokenHash(refreshToken, dbToken)) { ... }
 * 
 * 3. Export these functions:
 *    module.exports = {
 *      ...existing exports,
 *      hashToken,
 *      verifyTokenHash,
 *    };
 */
