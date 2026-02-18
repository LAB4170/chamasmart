const CryptoJS = require('crypto-js');
const crypto = require('crypto');
const logger = require('./logger');

/**
 * Encryption Utilities
 * Provides data encryption/decryption for sensitive information
 */

// Get encryption key from environment or generate one
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt sensitive data
 * @param {string} text - Text to encrypt
 * @returns {string} - Encrypted text with IV and auth tag
 */
function encrypt(text) {
  try {
    if (!text) return text;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv,
    );

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return IV:AuthTag:EncryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    logger.error('Encryption error', { error: error.message });
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedText - Encrypted text with IV and auth tag
 * @returns {string} - Decrypted text
 */
function decrypt(encryptedText) {
  try {
    if (!encryptedText) return encryptedText;

    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv,
    );

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.error('Decryption error', { error: error.message });
    throw new Error('Decryption failed');
  }
}

/**
 * Hash sensitive data (one-way)
 * @param {string} text - Text to hash
 * @returns {string} - Hashed text
 */
function hash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/**
 * Generate secure random token
 * @param {number} length - Token length
 * @returns {string} - Random token
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Encrypt object fields
 * @param {Object} obj - Object with fields to encrypt
 * @param {Array} fields - Fields to encrypt
 * @returns {Object} - Object with encrypted fields
 */
function encryptFields(obj, fields) {
  const encrypted = { ...obj };

  for (const field of fields) {
    if (encrypted[field]) {
      encrypted[field] = encrypt(encrypted[field]);
    }
  }

  return encrypted;
}

/**
 * Decrypt object fields
 * @param {Object} obj - Object with encrypted fields
 * @param {Array} fields - Fields to decrypt
 * @returns {Object} - Object with decrypted fields
 */
function decryptFields(obj, fields) {
  const decrypted = { ...obj };

  for (const field of fields) {
    if (decrypted[field]) {
      try {
        decrypted[field] = decrypt(decrypted[field]);
      } catch (error) {
        logger.warn('Failed to decrypt field', { field });
        // Keep encrypted value if decryption fails
      }
    }
  }

  return decrypted;
}

/**
 * Mask sensitive data for display
 * @param {string} text - Text to mask
 * @param {number} visibleChars - Number of visible characters at start/end
 * @returns {string} - Masked text
 */
function maskData(text, visibleChars = 4) {
  if (!text || text.length <= visibleChars * 2) {
    return '*'.repeat(text?.length || 8);
  }

  const start = text.substring(0, visibleChars);
  const end = text.substring(text.length - visibleChars);
  const masked = '*'.repeat(text.length - visibleChars * 2);

  return `${start}${masked}${end}`;
}

/**
 * Validate encryption key strength
 */
function validateEncryptionKey() {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 64) {
    logger.error('Weak or missing encryption key detected');
    throw new Error('Invalid encryption key configuration');
  }
}

// Validate on module load
if (process.env.NODE_ENV === 'production') {
  validateEncryptionKey();
}

module.exports = {
  encrypt,
  decrypt,
  hash,
  generateToken,
  encryptFields,
  decryptFields,
  maskData,
  validateEncryptionKey,
};
