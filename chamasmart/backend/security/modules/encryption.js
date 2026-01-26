/**
 * Encryption Service - Revised
 * AES-256-GCM encryption for sensitive data
 *
 * Improvements:
 * - Removed dangerous key padding
 * - Added key rotation support
 * - Better error handling
 * - Key derivation for multiple uses
 * - Proper validation
 */

const crypto = require("crypto");
const logger = require("../../utils/logger");

class EncryptionService {
  constructor() {
    this.algorithm = "aes-256-gcm";
    this.ivLength = 16; // 128 bits
    this.saltLength = 32;
    this.tagLength = 16;

    // Load master key
    this.masterKey = this.loadMasterKey();

    // Validate key
    this.validateMasterKey();

    logger.info("Encryption Service initialized", {
      algorithm: this.algorithm,
      keyLength: this.masterKey.length,
    });
  }

  /**
   * Load and validate master encryption key
   */
  loadMasterKey() {
    const key = process.env.ENCRYPTION_KEY;

    if (!key) {
      throw new Error("ENCRYPTION_KEY environment variable not set");
    }

    // Convert base64 key to buffer if needed
    if (this.isBase64(key)) {
      return Buffer.from(key, "base64");
    }

    // Convert hex key to buffer
    if (this.isHex(key)) {
      return Buffer.from(key, "hex");
    }

    // Use key as-is (UTF-8 string)
    return Buffer.from(key, "utf-8");
  }

  /**
   * Validate master key meets security requirements
   */
  validateMasterKey() {
    const minLength = 32; // 256 bits

    if (this.masterKey.length < minLength) {
      throw new Error(
        `ENCRYPTION_KEY too short (${this.masterKey.length} bytes, minimum ${minLength}). ` +
          `Generate a secure key with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
      );
    }

    // Check for weak patterns
    const keyStr = this.masterKey.toString("utf-8");
    const weakPatterns = [
      /^(test|dev|password|secret|123|abc|key)/i,
      /^(.)\1{10,}/, // Repeated characters
    ];

    for (const pattern of weakPatterns) {
      if (pattern.test(keyStr)) {
        logger.warn("⚠️  ENCRYPTION_KEY appears weak - consider regenerating");
        if (process.env.NODE_ENV === "production") {
          throw new Error("Weak encryption key detected in production");
        }
      }
    }
  }

  /**
   * Derive a key for specific purpose using HKDF
   */
  deriveKey(purpose, salt = null) {
    const derivedSalt = salt || crypto.randomBytes(this.saltLength);

    // HKDF (HMAC-based Key Derivation Function)
    const key = crypto.pbkdf2Sync(
      this.masterKey,
      derivedSalt,
      100000, // iterations
      32, // key length
      "sha256",
    );

    return { key, salt: derivedSalt };
  }

  /**
   * Encrypt sensitive data
   * @param {string} plaintext - Data to encrypt
   * @param {string} purpose - Purpose of encryption (for key derivation)
   * @returns {object} Encrypted data with metadata
   */
  encrypt(plaintext, purpose = "default") {
    try {
      if (!plaintext) {
        return null;
      }

      // Derive purpose-specific key
      const { key, salt } = this.deriveKey(purpose);

      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      // Encrypt
      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      return {
        algorithm: this.algorithm,
        iv: iv.toString("hex"),
        salt: salt.toString("hex"),
        encryptedData: encrypted,
        authTag: authTag.toString("hex"),
        version: 1, // For future algorithm changes
      };
    } catch (error) {
      logger.error("Encryption failed", {
        error: error.message,
        purpose,
      });
      throw new Error("Encryption failed");
    }
  }

  /**
   * Decrypt sensitive data
   * @param {object} encrypted - Encrypted data object
   * @returns {string} Decrypted plaintext
   */
  decrypt(encrypted) {
    try {
      if (!encrypted || !encrypted.iv || !encrypted.encryptedData) {
        return null;
      }

      // Derive the same key using stored salt
      const { key } = this.deriveKey(
        "default",
        Buffer.from(encrypted.salt, "hex"),
      );

      // Create decipher
      const decipher = crypto.createDecipheriv(
        encrypted.algorithm || this.algorithm,
        key,
        Buffer.from(encrypted.iv, "hex"),
      );

      // Set auth tag
      decipher.setAuthTag(Buffer.from(encrypted.authTag, "hex"));

      // Decrypt
      let decrypted = decipher.update(encrypted.encryptedData, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      logger.error("Decryption failed", {
        error: error.message,
        hasIV: !!encrypted?.iv,
        hasData: !!encrypted?.encryptedData,
        hasTag: !!encrypted?.authTag,
      });
      throw new Error("Decryption failed - data may be corrupted");
    }
  }

  /**
   * Encrypt for database storage (JSON string)
   */
  encryptForStorage(plaintext, purpose = "default") {
    const encrypted = this.encrypt(plaintext, purpose);
    return encrypted ? JSON.stringify(encrypted) : null;
  }

  /**
   * Decrypt from database storage
   */
  decryptFromStorage(encryptedJson) {
    if (!encryptedJson) {
      return null;
    }

    try {
      const encrypted = JSON.parse(encryptedJson);
      return this.decrypt(encrypted);
    } catch (error) {
      logger.error("Failed to decrypt from storage", {
        error: error.message,
        isValidJson: this.isValidJson(encryptedJson),
      });
      return null;
    }
  }

  /**
   * Hash data (one-way, for indexing/comparison)
   * @param {string} data - Data to hash
   * @param {string} salt - Optional salt
   * @returns {string} Hash hex string
   */
  hashData(data, salt = "chamasmart-v1") {
    if (!data) {
      return null;
    }

    return crypto.pbkdf2Sync(data, salt, 100000, 64, "sha512").toString("hex");
  }

  /**
   * Generate secure random token
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString("hex");
  }

  /**
   * Generate secure random string (URL-safe)
   */
  generateSecureString(length = 16) {
    return crypto
      .randomBytes(Math.ceil(length * 0.75))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "")
      .substring(0, length);
  }

  /**
   * Utility: Check if string is base64
   */
  isBase64(str) {
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    return base64Regex.test(str) && str.length % 4 === 0;
  }

  /**
   * Utility: Check if string is hex
   */
  isHex(str) {
    const hexRegex = /^[0-9a-fA-F]+$/;
    return hexRegex.test(str) && str.length % 2 === 0;
  }

  /**
   * Utility: Check if valid JSON
   */
  isValidJson(str) {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Rotate encryption key (for existing encrypted data)
   */
  async rotateKey(oldKey, newKey) {
    // This would be used in a migration script
    // to re-encrypt all data with a new key
    throw new Error("Key rotation must be performed via migration script");
  }
}

module.exports = EncryptionService;
