/**
 * JWT Key Management System
 * Supports key versioning and rotation for token security
 * 
 * File: backend/security/keyManagement.js
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

class JWTKeyManager {
  constructor() {
    // Current active key version
    this.activeKeyVersion = parseInt(process.env.JWT_KEY_VERSION || '1');
    
    // Load all key versions from environment
    // Format: JWT_SECRET_V1, JWT_SECRET_V2, JWT_SECRET_V3
    this.keys = {};
    
    // Load all available key versions
    for (let i = 1; i <= 10; i++) {
      const keyEnv = `JWT_SECRET_V${i}`;
      if (process.env[keyEnv]) {
        this.keys[i] = process.env[keyEnv];
      }
    }

    // Ensure we have at least the active key
    if (!this.keys[this.activeKeyVersion]) {
      logger.error('Active JWT key version not found in environment!', {
        activeVersion: this.activeKeyVersion,
        availableVersions: Object.keys(this.keys),
      });
      throw new Error(`JWT_SECRET_V${this.activeKeyVersion} not configured`);
    }

    logger.info('JWT Key Manager initialized', {
      activeVersion: this.activeKeyVersion,
      availableVersions: Object.keys(this.keys),
      environmentInfo: {
        nodeEnv: process.env.NODE_ENV,
        keyCount: Object.keys(this.keys).length,
      },
    });
  }

  /**
   * Get the currently active key for signing new tokens
   */
  getActiveKey() {
    return this.keys[this.activeKeyVersion];
  }

  /**
   * Get a specific key version for verification
   * Supports verifying tokens signed with old keys during rotation
   */
  getKeyForVerification(keyVersion) {
    const version = parseInt(keyVersion) || this.activeKeyVersion;
    const key = this.keys[version];

    if (!key) {
      logger.warn('Requested JWT key version not available', {
        requestedVersion: version,
        activeVersion: this.activeKeyVersion,
        availableVersions: Object.keys(this.keys),
      });
      return null;
    }

    return key;
  }

  /**
   * Get active key version
   */
  getActiveKeyVersion() {
    return this.activeKeyVersion;
  }

  /**
   * Validate all configured keys
   */
  validateKeys() {
    const issues = [];

    // Check minimum length
    Object.entries(this.keys).forEach(([version, key]) => {
      if (key.length < 32) {
        issues.push(`Key V${version} is too short (${key.length} chars, minimum 32)`);
      }
      
      // Check for weak patterns
      if (/^(test|dev|password|secret|123|abc)/.test(key.toLowerCase())) {
        issues.push(`Key V${version} appears to be a weak/development key`);
      }
    });

    if (issues.length > 0) {
      logger.warn('JWT key validation issues found:', { issues });
    }

    return issues;
  }

  /**
   * Check if a key is in rotation period
   * (Can be used for verifying tokens but not signing new ones)
   */
  isKeyInRotation(keyVersion) {
    const version = parseInt(keyVersion);
    return version !== this.activeKeyVersion && this.keys[version] !== undefined;
  }

  /**
   * Get token creation details
   * Returns object with signing parameters
   */
  getTokenSigningParams() {
    return {
      key: this.getActiveKey(),
      algorithm: 'HS256',
      keyid: this.activeKeyVersion.toString(),
    };
  }
}

// Singleton instance
let instance = null;

function getKeyManager() {
  if (!instance) {
    instance = new JWTKeyManager();
    // Validate on initialization
    const issues = instance.validateKeys();
    if (process.env.NODE_ENV === 'production' && issues.length > 0) {
      logger.error('Critical key validation errors in production', { issues });
      process.exit(1);
    }
  }
  return instance;
}

module.exports = {
  getKeyManager,
  JWTKeyManager,
};
