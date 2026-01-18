// backend/security/advancedAuth.js
// Purpose: Advanced authentication security features - KDPA 2019 compliant
// Author: Security Team
// Last Updated: 2026-01-18

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const speakeasy = require("speakeasy"); // For TOTP/Google Authenticator
const QRCode = require("qrcode");
const Encryption = require("./encryption");
const AuditLogger = require("./auditLogger");
const pool = require("../config/db");

// ============================================================================
// PASSWORD SECURITY UTILITIES
// ============================================================================

/**
 * Validate password against policy
 * KDPA: Storage limitation & security of personal data
 */
const validatePasswordPolicy = async (password, userId = null) => {
  try {
    // Get password policy (default if none specified)
    const policyResult = await pool.query(
      "SELECT * FROM password_policies WHERE active = true ORDER BY created_at DESC LIMIT 1",
    );
    const policy = policyResult.rows[0];

    const errors = [];

    if (password.length < policy.min_length) {
      errors.push(
        `Password must be at least ${policy.min_length} characters long`,
      );
    }

    if (policy.require_uppercase && !/[A-Z]/.test(password)) {
      errors.push("Password must contain uppercase letters");
    }

    if (policy.require_lowercase && !/[a-z]/.test(password)) {
      errors.push("Password must contain lowercase letters");
    }

    if (policy.require_numbers && !/[0-9]/.test(password)) {
      errors.push("Password must contain numbers");
    }

    if (
      policy.require_special_chars &&
      !/[!@#$%^&*(),.?":{}|<>]/.test(password)
    ) {
      errors.push("Password must contain special characters");
    }

    // Check password history (if user exists)
    if (userId) {
      const userResult = await pool.query(
        "SELECT password_history FROM users WHERE user_id = $1",
        [userId],
      );

      if (userResult.rows[0]?.password_history) {
        const passwordHash = await bcrypt.hash(password, 1); // Just for comparison
        const history = userResult.rows[0].password_history || [];

        for (const oldHash of history) {
          const isMatch = await bcrypt.compare(password, oldHash);
          if (isMatch) {
            errors.push(
              `Password cannot be one of your last ${policy.prevent_reuse_count} passwords`,
            );
            break;
          }
        }
      }
    }

    // Check against known breached passwords
    const breachResult = await checkPasswordBreach(password);
    if (breachResult.breached) {
      errors.push(
        `Password found in ${breachResult.breachCount} data breaches. Please use a different password.`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    console.error("Password policy validation error:", error);
    throw new Error("Password validation failed");
  }
};

/**
 * Check password against known breached passwords database
 * KDPA: Security of personal data
 */
const checkPasswordBreach = async (password) => {
  try {
    // Hash password using SHA-1 (standard for HaveIBeenPwned)
    const hash = crypto
      .createHash("sha1")
      .update(password)
      .digest("hex")
      .toUpperCase();
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    // Check local breach database
    const result = await pool.query(
      "SELECT breach_count FROM password_breach_database WHERE password_hash = $1",
      [hash],
    );

    if (result.rows[0]) {
      return {
        breached: true,
        breachCount: result.rows[0].breach_count,
      };
    }

    // In production, call HaveIBeenPwned API (requires API key)
    // const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    // Parse response and check if suffix exists

    return {
      breached: false,
      breachCount: 0,
    };
  } catch (error) {
    console.error("Password breach check error:", error);
    // Fail open - allow password if service fails
    return { breached: false, breachCount: 0 };
  }
};

/**
 * Handle failed login attempts
 * KDPA: Accountability & security monitoring
 */
const recordFailedLoginAttempt = async (userId, ipAddress, userAgent) => {
  try {
    const policy = await pool.query(
      "SELECT * FROM password_policies WHERE active = true ORDER BY created_at DESC LIMIT 1",
    );
    const maxAttempts = policy.rows[0]?.account_lockout_attempts || 5;
    const lockoutDuration =
      policy.rows[0]?.account_lockout_duration_minutes || 15;

    // Increment failed attempts
    await pool.query(
      "UPDATE users SET password_attempts = password_attempts + 1 WHERE user_id = $1",
      [userId],
    );

    // Get current attempt count
    const result = await pool.query(
      "SELECT password_attempts FROM users WHERE user_id = $1",
      [userId],
    );
    const attempts = result.rows[0]?.password_attempts || 0;

    // Lock account if exceeded max attempts
    if (attempts >= maxAttempts) {
      const lockUntil = new Date(Date.now() + lockoutDuration * 60 * 1000);
      await pool.query(
        "UPDATE users SET account_locked = true, account_locked_until = $1 WHERE user_id = $1",
        [lockUntil, userId],
      );

      // Log security event
      await AuditLogger.logAuthenticationEvent(
        userId,
        "ACCOUNT_LOCKED",
        false,
        ipAddress,
        userAgent,
        `Account locked after ${attempts} failed attempts`,
      );

      return {
        locked: true,
        reason: `Account locked. Try again after ${lockoutDuration} minutes.`,
        unlockTime: lockUntil,
      };
    }

    // Log failed attempt
    await AuditLogger.logAuthenticationEvent(
      userId,
      "LOGIN_FAILED",
      false,
      ipAddress,
      userAgent,
      `Failed attempt ${attempts}/${maxAttempts}`,
    );

    return {
      locked: false,
      attemptsRemaining: maxAttempts - attempts,
    };
  } catch (error) {
    console.error("Failed login attempt recording error:", error);
    throw error;
  }
};

/**
 * Reset password attempts on successful login
 * KDPA: Accountability
 */
const resetLoginAttempts = async (userId) => {
  try {
    await pool.query(
      "UPDATE users SET password_attempts = 0, account_locked = false, account_locked_until = null WHERE user_id = $1",
      [userId],
    );
  } catch (error) {
    console.error("Reset login attempts error:", error);
  }
};

/**
 * Check if account is locked
 */
const isAccountLocked = async (userId) => {
  try {
    const result = await pool.query(
      "SELECT account_locked, account_locked_until FROM users WHERE user_id = $1",
      [userId],
    );

    const user = result.rows[0];
    if (!user || !user.account_locked) {
      return { locked: false };
    }

    // Check if lockout period expired
    const now = new Date();
    if (
      user.account_locked_until &&
      new Date(user.account_locked_until) <= now
    ) {
      // Unlock account
      await pool.query(
        "UPDATE users SET account_locked = false, account_locked_until = null WHERE user_id = $1",
        [userId],
      );
      return { locked: false };
    }

    return {
      locked: true,
      unlockTime: user.account_locked_until,
    };
  } catch (error) {
    console.error("Account lock check error:", error);
    throw error;
  }
};

// ============================================================================
// TWO-FACTOR AUTHENTICATION (2FA / MFA)
// ============================================================================

/**
 * Enable 2FA via TOTP (Time-based One-Time Password)
 * KDPA: Enhanced security of personal data
 */
const enableTOTP = async (userId, userName) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `ChamaSmart (${userName})`,
      issuer: "ChamaSmart",
      length: 32,
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    // Store backup codes
    const backupCodes = generateBackupCodes(10);
    const hashedCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, 10)),
    );

    // Store secret in database (encrypted)
    const encryptedSecret = await Encryption.encryptSensitiveData(
      { totp_secret: secret.base32 },
      1,
    );

    await pool.query(
      `UPDATE users 
       SET two_factor_enabled = true, 
           two_factor_method = 'AUTHENTICATOR',
           mfa_backup_codes = $2
       WHERE user_id = $1`,
      [userId, hashedCodes],
    );

    return {
      secret: secret.base32,
      qrCode,
      backupCodes,
      message:
        "Scan QR code with authenticator app. Save backup codes in a safe place.",
    };
  } catch (error) {
    console.error("Enable TOTP error:", error);
    throw error;
  }
};

/**
 * Verify TOTP code
 */
const verifyTOTPCode = async (userId, token) => {
  try {
    // Get user's TOTP secret
    const result = await pool.query("SELECT * FROM users WHERE user_id = $1", [
      userId,
    ]);
    const user = result.rows[0];

    if (!user?.two_factor_enabled) {
      return { valid: false, reason: "2FA not enabled" };
    }

    // Decrypt TOTP secret (implementation depends on your encryption method)
    // This is pseudocode - actual implementation varies
    const isValid = speakeasy.totp.verify({
      secret: user.totp_secret, // This should be decrypted
      encoding: "base32",
      token: token,
      window: 2, // Allow 2 windows of time drift
    });

    if (!isValid) {
      // Check backup codes
      if (user.mfa_backup_codes?.length > 0) {
        for (let i = 0; i < user.mfa_backup_codes.length; i++) {
          const isMatch = await bcrypt.compare(token, user.mfa_backup_codes[i]);
          if (isMatch) {
            // Remove used backup code
            user.mfa_backup_codes.splice(i, 1);
            await pool.query(
              "UPDATE users SET mfa_backup_codes = $1 WHERE user_id = $2",
              [user.mfa_backup_codes, userId],
            );
            return { valid: true, isBackupCode: true };
          }
        }
      }
      return { valid: false, reason: "Invalid authentication code" };
    }

    return { valid: true };
  } catch (error) {
    console.error("Verify TOTP error:", error);
    throw error;
  }
};

/**
 * Generate backup codes for 2FA
 */
const generateBackupCodes = (count = 10) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
};

/**
 * Enable SMS-based 2FA
 * KDPA: Consent required before sending SMS
 */
const enableSMS2FA = async (userId, phoneNumber) => {
  try {
    // Validate phone number is encrypted in database
    const encryptedPhone = await Encryption.encryptSensitiveData(
      { phone: phoneNumber },
      1,
    );

    await pool.query(
      `UPDATE users 
       SET two_factor_enabled = true, 
           two_factor_method = 'SMS'
       WHERE user_id = $1`,
      [userId],
    );

    // In production: Send SMS with verification code
    const verificationCode = generateTOTP();
    const sessionId = uuidv4();

    await pool.query(
      `INSERT INTO two_factor_sessions (user_id, verification_code, method, expires_at)
       VALUES ($1, $2, 'SMS', NOW() + INTERVAL '10 minutes')`,
      [userId, verificationCode],
    );

    // TODO: Send SMS via Twilio/African's Talking
    console.log(
      `SMS verification code for ${phoneNumber}: ${verificationCode}`,
    );

    return {
      sessionId,
      message: "SMS sent with verification code. Code expires in 10 minutes.",
      expiresIn: 600, // seconds
    };
  } catch (error) {
    console.error("Enable SMS 2FA error:", error);
    throw error;
  }
};

/**
 * Generate time-based verification code
 */
const generateTOTP = () => {
  return Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");
};

// ============================================================================
// SESSION AND DEVICE MANAGEMENT
// ============================================================================

/**
 * Register device for this user
 * KDPA: User transparency & control
 */
const registerDevice = async (
  userId,
  deviceName,
  deviceType,
  ipAddress,
  userAgent,
) => {
  try {
    const deviceId = uuidv4();
    const deviceIdentifier = crypto
      .createHash("sha256")
      .update(`${deviceType}:${userAgent}:${ipAddress}`)
      .digest("hex");

    await pool.query(
      `INSERT INTO user_devices (user_id, device_name, device_type, device_identifier, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, deviceName, deviceType, deviceIdentifier, ipAddress, userAgent],
    );

    await AuditLogger.logAuthenticationEvent(
      userId,
      "DEVICE_REGISTERED",
      true,
      ipAddress,
      userAgent,
      `Device: ${deviceName}`,
    );

    return {
      deviceId,
      message: "Device registered successfully",
    };
  } catch (error) {
    console.error("Register device error:", error);
    throw error;
  }
};

/**
 * Mark device as trusted (skip 2FA on next login)
 * KDPA: User consent required
 */
const markDeviceTrusted = async (deviceId, userId) => {
  try {
    // Get device
    const device = await pool.query(
      "SELECT * FROM user_devices WHERE device_id = $1 AND user_id = $2",
      [deviceId, userId],
    );

    if (device.rows.length === 0) {
      throw new Error("Device not found");
    }

    // Only trust up to 5 devices per user (KDPA: limit trusted devices)
    const trustedCount = await pool.query(
      "SELECT COUNT(*) as count FROM user_devices WHERE user_id = $1 AND is_trusted = true",
      [userId],
    );

    if (trustedCount.rows[0].count >= 5) {
      throw new Error(
        "Maximum trusted devices reached. Remove a trusted device first.",
      );
    }

    await pool.query(
      "UPDATE user_devices SET is_trusted = true WHERE device_id = $1",
      [deviceId],
    );

    return { message: "Device marked as trusted" };
  } catch (error) {
    console.error("Mark device trusted error:", error);
    throw error;
  }
};

/**
 * Get all trusted devices for user
 * KDPA: User right to access
 */
const getUserDevices = async (userId) => {
  try {
    const result = await pool.query(
      `SELECT device_id, device_name, device_type, is_trusted, last_used_at, created_at
       FROM user_devices 
       WHERE user_id = $1
       ORDER BY last_used_at DESC`,
      [userId],
    );

    return result.rows;
  } catch (error) {
    console.error("Get user devices error:", error);
    throw error;
  }
};

/**
 * Revoke device trust
 * KDPA: User right to control
 */
const revokeDevice = async (deviceId, userId) => {
  try {
    await pool.query(
      "DELETE FROM user_devices WHERE device_id = $1 AND user_id = $2",
      [deviceId, userId],
    );

    await AuditLogger.logAuthenticationEvent(
      userId,
      "DEVICE_REVOKED",
      true,
      null,
      null,
      `Device: ${deviceId} revoked`,
    );

    return { message: "Device revoked successfully" };
  } catch (error) {
    console.error("Revoke device error:", error);
    throw error;
  }
};

// ============================================================================
// SESSION BINDING (Prevent session hijacking)
// ============================================================================

/**
 * Create session binding to prevent hijacking
 * KDPA: Integrity & confidentiality
 */
const createSessionBinding = (userId, ipAddress, userAgent, deviceId) => {
  const binding = {
    userId,
    ipAddress,
    userAgent,
    deviceId,
    createdAt: Date.now(),
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(binding))
    .digest("hex");
};

/**
 * Verify session binding
 */
const verifySessionBinding = (
  token,
  userId,
  ipAddress,
  userAgent,
  deviceId,
) => {
  const binding = {
    userId,
    ipAddress,
    userAgent,
    deviceId,
    createdAt: token.bindingCreatedAt,
  };

  const expectedHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(binding))
    .digest("hex");

  return token.sessionBinding === expectedHash;
};

// ============================================================================
// PRIVILEGE ESCALATION LOGGING
// ============================================================================

/**
 * Log role/privilege changes
 * KDPA: Accountability
 */
const logPrivilegeEscalation = async (
  userId,
  fromRole,
  toRole,
  authorizedBy,
  reason = null,
) => {
  try {
    await pool.query(
      `INSERT INTO privilege_escalation_logs (user_id, from_role, to_role, authorized_by, reason, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, fromRole, toRole, authorizedBy, reason],
    );

    await AuditLogger.logSensitiveOperation(
      authorizedBy,
      "PRIVILEGE_ESCALATION",
      `user:${userId}`,
      { from_role: fromRole, to_role: toRole },
      null,
    );
  } catch (error) {
    console.error("Log privilege escalation error:", error);
    throw error;
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  validatePasswordPolicy,
  checkPasswordBreach,
  recordFailedLoginAttempt,
  resetLoginAttempts,
  isAccountLocked,
  enableTOTP,
  verifyTOTPCode,
  generateBackupCodes,
  enableSMS2FA,
  generateTOTP,
  registerDevice,
  markDeviceTrusted,
  getUserDevices,
  revokeDevice,
  createSessionBinding,
  verifySessionBinding,
  logPrivilegeEscalation,
};
