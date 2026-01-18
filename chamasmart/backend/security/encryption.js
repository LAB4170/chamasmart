/**
 * Encryption Module for Sensitive Data
 * Implements AES-256 encryption for GDPR/KDPA compliance
 */

const crypto = require("crypto");
const logger = require("../utils/logger");

class EncryptionService {
  constructor() {
    // Get encryption key from environment
    this.masterKey = process.env.ENCRYPTION_KEY;
    this.algorithm = "aes-256-gcm";

    if (!this.masterKey) {
      throw new Error("ENCRYPTION_KEY environment variable not set");
    }

    // Ensure key is 32 bytes for AES-256
    if (this.masterKey.length < 32) {
      logger.warn(
        "ENCRYPTION_KEY too short, padding with zeros (NOT FOR PRODUCTION)",
      );
      this.masterKey = this.masterKey.padEnd(32, "0");
    } else if (this.masterKey.length > 32) {
      this.masterKey = this.masterKey.substring(0, 32);
    }
  }

  /**
   * Encrypt sensitive data
   * @param {string} plaintext - Data to encrypt
   * @returns {object} {iv, encryptedData, authTag} - Encrypted data with IV and auth tag
   */
  encrypt(plaintext) {
    try {
      if (!plaintext) return null;

      const iv = crypto.randomBytes(16); // 128-bit IV
      const cipher = crypto.createCipheriv(
        this.algorithm,
        Buffer.from(this.masterKey),
        iv,
      );

      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();

      return {
        iv: iv.toString("hex"),
        encryptedData: encrypted,
        authTag: authTag.toString("hex"),
        algorithm: this.algorithm,
      };
    } catch (error) {
      logger.error("Encryption failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Decrypt sensitive data
   * @param {object} encrypted - {iv, encryptedData, authTag}
   * @returns {string} Decrypted plaintext
   */
  decrypt(encrypted) {
    try {
      if (!encrypted || !encrypted.iv || !encrypted.encryptedData) {
        return null;
      }

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        Buffer.from(this.masterKey),
        Buffer.from(encrypted.iv, "hex"),
      );

      decipher.setAuthTag(Buffer.from(encrypted.authTag, "hex"));

      let decrypted = decipher.update(encrypted.encryptedData, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      logger.error("Decryption failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Store encrypted data as JSON string for database
   * @param {string} plaintext - Data to encrypt
   * @returns {string} JSON stringified encryption object
   */
  encryptForStorage(plaintext) {
    const encrypted = this.encrypt(plaintext);
    return JSON.stringify(encrypted);
  }

  /**
   * Retrieve and decrypt data from storage
   * @param {string} encrypted - JSON stringified encryption object
   * @returns {string} Decrypted plaintext
   */
  decryptFromStorage(encrypted) {
    if (!encrypted) return null;
    try {
      const encryptedObj = JSON.parse(encrypted);
      return this.decrypt(encryptedObj);
    } catch (error) {
      logger.error("Failed to decrypt from storage", { error: error.message });
      return null;
    }
  }

  /**
   * Hash sensitive data (one-way, for comparisons like emails)
   * @param {string} data - Data to hash
   * @param {string} salt - Salt for hashing
   * @returns {string} Hashed value
   */
  hashData(data, salt = "chamasmart") {
    return crypto.pbkdf2Sync(data, salt, 100000, 64, "sha512").toString("hex");
  }
}

module.exports = new EncryptionService();
