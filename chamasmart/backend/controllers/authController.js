/**
 * Production-Grade Authentication Controller
 * Fixes: Rate limiting, account lockout, secure OTP, breach detection
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const redis = require('../config/redis');
const logger = require('../utils/logger');
const { logAuditEvent, EVENT_TYPES, SEVERITY } = require('../utils/auditLog');
const { sanitizeMetadata } = require('../utils/auditLog');
const {
  isValidEmail,
  isValidPhone,
  isStrongPassword,
} = require('../utils/validators');

// SECURITY CONFIGURATIONS

const SECURITY_CONFIG = {
  // Rate limiting (using Redis)
  LOGIN_ATTEMPTS: {
    MAX_ATTEMPTS: 5,
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    LOCKOUT_DURATION: 30 * 60 * 1000, // 30 minutes
  },

  OTP: {
    LENGTH: 6,
    EXPIRY_MINUTES: 10,
    MAX_RESEND: 3,
    RESEND_COOLDOWN_MS: 2 * 60 * 1000, // 2 minutes
    MAX_VERIFY_ATTEMPTS: 5,
  },

  PASSWORD: {
    MIN_LENGTH: 12,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBER: true,
    REQUIRE_SPECIAL: true,
    BCRYPT_ROUNDS: 12,
    HISTORY_COUNT: 5, // Remember last 5 passwords
  },

  JWT: {
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '7d',
    ISSUER: 'chamasmart',
    AUDIENCE: 'chamasmart-api',
  },
};

// ============================================================================
// RATE LIMITING MIDDLEWARE
// ============================================================================

class RateLimiter {
  /**
   * Check if IP/User has exceeded rate limits
   * @param {string} key - Unique identifier (IP, userId, email)
   * @param {object} config - Rate limit configuration
   * @returns {Promise<{allowed: boolean, remaining: number, resetAt: Date}>}
   */
  static async checkLimit(key, config) {
    const redisKey = `ratelimit:${key}`;
    const now = Date.now();

    try {
      // Get current count and window start
      const data = await redis.get(redisKey);
      let attempts = data ? JSON.parse(data) : { count: 0, windowStart: now };

      // Reset window if expired
      if (now - attempts.windowStart > config.WINDOW_MS) {
        attempts = { count: 0, windowStart: now };
      }

      // Check if locked out
      const lockoutKey = `lockout:${key}`;
      const isLockedOut = await redis.get(lockoutKey);

      // Log lockout events
      if (isLockedOut && attempts.count >= config.MAX_ATTEMPTS) {
        const ttl = await redis.ttl(lockoutKey);
        await logAuditEvent({
          eventType: EVENT_TYPES.AUTH_ACCOUNT_LOCKED,
          userId: key.startsWith('user:') ? key.split(':')[1] : null,
          action: 'Account locked due to too many failed attempts',
          entityType: 'user',
          entityId: key.startsWith('email:') ? key.split(':')[1] : key,
          metadata: {
            ipAddress: key.startsWith('ip:') ? key.split(':')[1] : null,
            failedAttempts: attempts.count,
            unlockTime: new Date(now + ttl * 1000).toISOString(),
            reason: 'Too many failed login attempts',
          },
          ipAddress: key.startsWith('ip:') ? key.split(':')[1] : null,
          severity: SEVERITY.HIGH,
        });
      }

      if (isLockedOut) {
        const ttl = await redis.ttl(lockoutKey);
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(now + ttl * 1000),
          lockedOut: true,
        };
      }

      // Check if limit exceeded
      if (attempts.count >= config.MAX_ATTEMPTS) {
        // Trigger lockout
        await redis.setex(
          lockoutKey,
          Math.floor(config.LOCKOUT_DURATION / 1000),
          'locked',
        );

        logger.logSecurityEvent('Account locked due to rate limit', { key });

        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(now + config.LOCKOUT_DURATION),
          lockedOut: true,
        };
      }

      // Increment counter
      attempts.count++;
      await redis.setex(
        redisKey,
        Math.floor(config.WINDOW_MS / 1000),
        JSON.stringify(attempts),
      );

      return {
        allowed: true,
        remaining: config.MAX_ATTEMPTS - attempts.count,
        resetAt: new Date(attempts.windowStart + config.WINDOW_MS),
        lockedOut: false,
      };
    } catch (error) {
      logger.logError(error, { context: 'RateLimiter.checkLimit', key });
      // Fail open in case of Redis issues (but log the error)
      return { allowed: true, remaining: 999, resetAt: new Date() };
    }
  }

  /**
   * Reset rate limit for a key (after successful operation)
   */
  static async reset(key) {
    await redis.del(`ratelimit:${key}`);
    await redis.del(`lockout:${key}`);
  }
}

// ============================================================================
// SECURE OTP GENERATION
// ============================================================================

class OTPService {
  /**
   * Generate cryptographically secure OTP
   * Uses crypto.randomInt instead of Math.random
   */
  static generate(length = SECURITY_CONFIG.OTP.LENGTH) {
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += crypto.randomInt(0, 10).toString();
    }
    return otp;
  }

  /**
   * Store OTP in Redis with metadata
   */
  static async store(identifier, otp, type = 'email') {
    const key = `otp:${type}:${identifier}`;
    const data = {
      otp,
      attempts: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + SECURITY_CONFIG.OTP.EXPIRY_MINUTES * 60 * 1000,
    };

    await redis.setex(
      key,
      SECURITY_CONFIG.OTP.EXPIRY_MINUTES * 60,
      JSON.stringify(data),
    );

    // Track resend attempts
    const resendKey = `otp:resend:${type}:${identifier}`;
    const resendCount = await redis.incr(resendKey);

    if (resendCount === 1) {
      // Set expiry on first increment
      await redis.expire(
        resendKey,
        Math.floor(SECURITY_CONFIG.OTP.RESEND_COOLDOWN_MS / 1000),
      );
    }

    if (resendCount > SECURITY_CONFIG.OTP.MAX_RESEND) {
      throw new Error(
        'Maximum OTP resend limit exceeded. Please try again later.',
      );
    }

    return { resendCount, maxResend: SECURITY_CONFIG.OTP.MAX_RESEND };
  }

  /**
   * Verify OTP with rate limiting
   */
  static async verify(identifier, inputOtp, type = 'email') {
    const key = `otp:${type}:${identifier}`;
    const dataStr = await redis.get(key);

    if (!dataStr) {
      // Log failed OTP verification attempt
      await logAuditEvent({
        eventType: EVENT_TYPES.AUTH_FAILED_OTP,
        userId: null,
        action: 'Invalid OTP attempt',
        entityType: 'user',
        entityId: identifier,
        metadata: {
          reason: 'OTP not found or expired',
          otpType: type,
        },
        severity: SEVERITY.MEDIUM,
      });
      throw new Error('OTP not found or expired');
    }

    const data = JSON.parse(dataStr);

    // Check expiry
    if (Date.now() > data.expiresAt) {
      await redis.del(key);
      throw new Error('OTP has expired. Please request a new one.');
    }

    // Check attempts
    if (data.attempts >= SECURITY_CONFIG.OTP.MAX_VERIFY_ATTEMPTS) {
      await redis.del(key);
      throw new Error(
        'Maximum verification attempts exceeded. Please request a new OTP.',
      );
    }

    // Verify OTP
    if (data.otp !== inputOtp) {
      data.attempts++;
      await redis.setex(
        key,
        Math.floor((data.expiresAt - Date.now()) / 1000),
        JSON.stringify(data),
      );

      throw new Error(
        `Invalid OTP. ${SECURITY_CONFIG.OTP.MAX_VERIFY_ATTEMPTS - data.attempts} attempts remaining.`,
      );
    }

    // Success - delete OTP
    await redis.del(key);
    await redis.del(`otp:resend:${type}:${identifier}`);

    return true;
  }

  /**
   * Verify phone OTP specifically
   */
  static async verifyPhoneOTP(userId, inputOtp) {
    try {
      // Get user's phone number from database
      const userResult = await pool.query(
        'SELECT phone_number FROM users WHERE user_id = $1',
        [userId],
      );

      if (userResult.rows.length === 0) {
        return { valid: false, message: 'User not found' };
      }

      const phone = userResult.rows[0].phone_number;

      // Verify OTP using the general verify method
      await this.verify(phone, inputOtp, 'phone');

      return { valid: true, message: 'Phone verified successfully' };
    } catch (error) {
      return { valid: false, message: error.message };
    }
  }
}

// ============================================================================
// PASSWORD SECURITY
// ============================================================================

class PasswordService {
  /**
   * Enhanced password validation
   */
  static validate(password) {
    const errors = [];

    if (password.length < SECURITY_CONFIG.PASSWORD.MIN_LENGTH) {
      errors.push(
        `Password must be at least ${SECURITY_CONFIG.PASSWORD.MIN_LENGTH} characters`,
      );
    }

    if (SECURITY_CONFIG.PASSWORD.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (SECURITY_CONFIG.PASSWORD.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (SECURITY_CONFIG.PASSWORD.REQUIRE_NUMBER && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (
      SECURITY_CONFIG.PASSWORD.REQUIRE_SPECIAL
      && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    ) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common patterns
    const commonPatterns = ['123456', 'password', 'qwerty', 'abc123'];
    if (
      commonPatterns.some(pattern => password.toLowerCase().includes(pattern))
    ) {
      errors.push(
        'Password contains common patterns. Please choose a more unique password.',
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check against breached password database (simulated)
   * In production, integrate with haveibeenpwned.com API
   */
  static async checkBreach(password) {
    // Hash password using SHA-1 (as required by HIBP API)
    const hash = crypto
      .createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    try {
      // In production: Call HIBP API
      // const response = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`);
      // const hashes = response.data.split('\n');
      // const found = hashes.find(line => line.startsWith(suffix));

      // Simulated for now
      const commonHashes = ['5BAA6', '7C4A8']; // Hashes of "password" and "123456"
      if (commonHashes.includes(prefix)) {
        return {
          breached: true,
          message:
            'This password has been found in data breaches. Please choose a different password.',
        };
      }

      return { breached: false };
    } catch (error) {
      logger.logError(error, { context: 'PasswordService.checkBreach' });
      // Fail open - don't block user if API is down
      return { breached: false };
    }
  }

  /**
   * Hash password with configurable rounds
   */
  static async hash(password) {
    return bcrypt.hash(password, SECURITY_CONFIG.PASSWORD.BCRYPT_ROUNDS);
  }

  /**
   * Check password history to prevent reuse
   */
  static async checkHistory(userId, newPassword) {
    const result = await pool.query(
      `SELECT password_hash FROM password_history 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, SECURITY_CONFIG.PASSWORD.HISTORY_COUNT],
    );

    for (const row of result.rows) {
      const matches = await bcrypt.compare(newPassword, row.password_hash);
      if (matches) {
        return {
          reused: true,
          message: 'Password has been used recently. Please choose a different password.',
        };
      }
    }

    return { reused: false };
  }

  /**
   * Save password to history
   */
  static async saveToHistory(client, userId, passwordHash) {
    // Delete old history beyond limit
    await client.query(
      `DELETE FROM password_history 
       WHERE user_id = $1 
       AND password_id NOT IN (
         SELECT password_id FROM password_history 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2
       )`,
      [userId, SECURITY_CONFIG.PASSWORD.HISTORY_COUNT - 1],
    );

    // Insert new password
    await client.query(
      `INSERT INTO password_history (user_id, password_hash) 
       VALUES ($1, $2)`,
      [userId, passwordHash],
    );
  }
}

// ============================================================================
// JWT TOKEN MANAGEMENT
// ============================================================================

class TokenService {
  /**
   * Generate access token with proper claims
   */
  static generateAccessToken(user) {
    const payload = {
      sub: user.user_id, // Subject (user ID)
      email: user.email,
      role: user.role || 'member',
      type: 'access',
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: SECURITY_CONFIG.JWT.ACCESS_TOKEN_EXPIRY,
      issuer: SECURITY_CONFIG.JWT.ISSUER,
      audience: SECURITY_CONFIG.JWT.AUDIENCE,
      jwtid: crypto.randomUUID(), // Unique token ID
    });
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(user) {
    const payload = {
      sub: user.user_id,
      type: 'refresh',
    };

    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: SECURITY_CONFIG.JWT.REFRESH_TOKEN_EXPIRY,
      issuer: SECURITY_CONFIG.JWT.ISSUER,
      audience: SECURITY_CONFIG.JWT.AUDIENCE,
      jwtid: crypto.randomUUID(),
    });
  }

  /**
   * Verify and decode token
   */
  static verify(token, type = 'access') {
    const secret = type === 'access'
      ? process.env.JWT_SECRET
      : process.env.JWT_REFRESH_SECRET;

    try {
      const decoded = jwt.verify(token, secret, {
        issuer: SECURITY_CONFIG.JWT.ISSUER,
        audience: SECURITY_CONFIG.JWT.AUDIENCE,
      });

      // Check token type
      if (decoded.type !== type) {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw error;
      }
    }
  }

  /**
   * Revoke token (add to blacklist)
   */
  static async revoke(token, type = 'access') {
    try {
      const decoded = this.verify(token, type);
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);

      if (ttl > 0) {
        await redis.setex(`blacklist:${decoded.jti}`, ttl, 'revoked');
      }
    } catch (error) {
      // Token already invalid, no need to blacklist
      logger.logWarning('Attempted to revoke invalid token', {
        error: error.message,
      });
    }
  }

  /**
   * Check if token is blacklisted
   */
  static async isBlacklisted(token, type = 'access') {
    try {
      const decoded = this.verify(token, type);
      const blacklisted = await redis.get(`blacklist:${decoded.jti}`);
      return !!blacklisted;
    } catch (error) {
      return true; // Treat invalid tokens as blacklisted
    }
  }

  /**
   * Generate email verification token
   */
  static generateEmailVerificationToken(email) {
    const payload = {
      type: 'email_verification',
      email,
      userId: email, // Will be updated when we have user ID
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h',
      issuer: SECURITY_CONFIG.JWT.ISSUER,
      audience: SECURITY_CONFIG.JWT.AUDIENCE,
      jwtid: this.generateJTI(),
    });
  }

  /**
   * Generate phone verification token
   */
  static generatePhoneVerificationToken(userId, phone) {
    const payload = {
      type: 'phone_verification',
      userId,
      phone,
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '1h',
      issuer: SECURITY_CONFIG.JWT.ISSUER,
      audience: SECURITY_CONFIG.JWT.AUDIENCE,
      jwtid: this.generateJTI(),
    });
  }

  /**
   * Verify email/phone verification token
   */
  static verify(token, type = 'access') {
    const decoded = jwt.verify(token, this.getSecret(type), {
      issuer: SECURITY_CONFIG.JWT.ISSUER,
      audience: SECURITY_CONFIG.JWT.AUDIENCE,
    });

    // Additional verification for specific token types
    if (
      type === 'email_verification'
      && decoded.type !== 'email_verification'
    ) {
      throw new Error('Invalid token type');
    }

    if (
      type === 'phone_verification'
      && decoded.type !== 'phone_verification'
    ) {
      throw new Error('Invalid token type');
    }

    return decoded;
  }

  /**
   * Get secret based on token type
   */
  static getSecret(type) {
    switch (type) {
    case 'refresh':
      return process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    case 'email_verification':
    case 'phone_verification':
      return process.env.JWT_SECRET;
    default:
      return process.env.JWT_SECRET;
    }
  }
}
// REFACTORED REGISTRATION ENDPOINT
// ============================================================================

const register = async (req, res) => {
  const auditContext = {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: {
      registrationMethod: 'email',
      ...sanitizeMetadata(req.body),
    },
  };

  try {
    // Log registration attempt
    await logAuditEvent({
      eventType: EVENT_TYPES.AUTH_REGISTER_ATTEMPT,
      userId: null,
      action: 'Registration attempt',
      entityType: 'user',
      entityId: req.body.email,
      metadata: auditContext.metadata,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      severity: SEVERITY.MEDIUM,
    });

    const client = await pool.connect();

    try {
      const {
        email, password, firstName, lastName, phoneNumber,
      } = req.body;

      // === VALIDATION ===
      if (!email || !password || !firstName || !lastName || !phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Please provide all required fields',
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email address',
        });
      }

      if (!isValidPhone(phoneNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number',
        });
      }

      // === ENHANCED PASSWORD VALIDATION ===
      const passwordValidation = PasswordService.validate(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          success: false,
          message: 'Password does not meet security requirements',
          errors: passwordValidation.errors,
        });
      }

      // === CHECK BREACHED PASSWORDS ===
      const breachCheck = await PasswordService.checkBreach(password);
      if (breachCheck.breached) {
        return res.status(400).json({
          success: false,
          message: breachCheck.message,
        });
      }

      // === RATE LIMITING (by IP) ===
      const clientIP = req.ip || req.connection.remoteAddress;
      const rateLimit = await RateLimiter.checkLimit(`register:${clientIP}`, {
        MAX_ATTEMPTS: 5,
        WINDOW_MS: 60 * 60 * 1000,
        LOCKOUT_DURATION: 60 * 60 * 1000,
      });

      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Too many registration attempts. Please try again later.',
          resetAt: rateLimit.resetAt,
        });
      }

      // === CHECK EXISTING USER ===
      const normalizedPhone = normalizePhone(phoneNumber);
      const userExists = await pool.query(
        'SELECT * FROM users WHERE email = $1 OR phone_number = $2',
        [email.toLowerCase(), normalizedPhone],
      );

      if (userExists.rows.length > 0) {
        // Log duplicate registration attempt
        await logAuditEvent({
          eventType: EVENT_TYPES.AUTH_REGISTER_ATTEMPT,
          userId: null,
          action: 'Duplicate registration attempt',
          entityType: 'user',
          entityId: req.body.email,
          metadata: {
            ...auditContext.metadata,
            reason: 'Email already exists',
          },
          ipAddress: auditContext.ipAddress,
          userAgent: auditContext.userAgent,
          severity: SEVERITY.LOW,
        });

        return res.status(400).json({
          success: false,
          message: 'User with this email or phone number already exists',
        });
      }

      await client.query('BEGIN');

      // === HASH PASSWORD ===
      const hashedPassword = await PasswordService.hash(password);

      // === CREATE USER ===
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone_number)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING user_id, email, first_name, last_name, phone_number, created_at`,
        [
          email.toLowerCase(),
          hashedPassword,
          firstName,
          lastName,
          normalizedPhone,
        ],
      );

      const user = userResult.rows[0];

      // === SAVE PASSWORD HISTORY ===
      await PasswordService.saveToHistory(client, user.user_id, hashedPassword);

      // === GENERATE SECURE OTP ===
      const emailOtp = OTPService.generate();
      const phoneOtp = OTPService.generate();

      await OTPService.store(email.toLowerCase(), emailOtp, 'email');
      await OTPService.store(normalizedPhone, phoneOtp, 'phone');

      await client.query('COMMIT');

      // Log successful registration
      await logAuditEvent({
        eventType: EVENT_TYPES.AUTH_REGISTER,
        userId: user.user_id,
        action: 'User registration successful',
        entityType: 'user',
        entityId: user.user_id,
        metadata: {
          ...auditContext.metadata,
          userId: user.user_id,
          registrationDate: new Date().toISOString(),
        },
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        severity: SEVERITY.MEDIUM,
      });

      // === SEND VERIFICATION (async) ===
      // Don't await - send in background
      sendEmailVerification(email, emailOtp).catch(err => logger.logError(err, { context: 'sendEmailVerification', email }));

      sendPhoneVerification(normalizedPhone, phoneOtp).catch(err => logger.logError(err, {
        context: 'sendPhoneVerification',
        phone: normalizedPhone,
      }));

      // === GENERATE TOKENS ===
      const accessToken = TokenService.generateAccessToken(user);
      const refreshToken = TokenService.generateRefreshToken(user);

      // === STORE REFRESH TOKEN ===
      await pool.query(
        `INSERT INTO refresh_tokens (user_id, token, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
        [user.user_id, refreshToken],
      );

      // === AUDIT LOG ===
      logger.logSecurityEvent('User registered', {
        userId: user.user_id,
        email: user.email,
        ip: clientIP,
      });

      res.status(201).json({
        success: true,
        message:
          'User registered successfully. Please verify your email and phone.',
        data: {
          user: {
            id: user.user_id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phoneNumber: user.phone_number,
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: SECURITY_CONFIG.JWT.ACCESS_TOKEN_EXPIRY,
          },
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.logError(error, {
        context: 'auth_register',
        email: req.body?.email,
      });

      res.status(500).json({
        success: false,
        message: 'Error registering user',
      });
    } finally {
      client.release();
    }
  } catch (error) {
    logger.logError(error, {
      context: 'register_outer',
      email: req.body?.email,
    });

    res.status(500).json({
      success: false,
      message: 'Registration service error',
    });
  }
};

// ============================================================================
// LOGIN ENDPOINT
// ============================================================================

const login = async (req, res) => {
  const { email, password } = req.body;
  const auditContext = {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    metadata: {
      loginMethod: 'password',
      email,
    },
  };

  try {
    // Log login attempt
    await logAuditEvent({
      eventType: EVENT_TYPES.AUTH_LOGIN_ATTEMPT,
      userId: null,
      action: 'Login attempt',
      entityType: 'user',
      entityId: email,
      metadata: auditContext.metadata,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      severity: SEVERITY.MEDIUM,
    });

    const clientIP = req.ip || req.connection.remoteAddress;

    // === RATE LIMITING (by email + IP) ===
    const rateLimitKey = `login:${email}:${clientIP}`;
    const rateLimit = await RateLimiter.checkLimit(
      rateLimitKey,
      SECURITY_CONFIG.LOGIN_ATTEMPTS,
    );

    if (!rateLimit.allowed) {
      logger.logSecurityEvent('Account locked - too many login attempts', {
        email,
        ip: clientIP,
        resetAt: rateLimit.resetAt,
      });

      return res.status(429).json({
        success: false,
        message: rateLimit.lockedOut
          ? `Account temporarily locked due to too many failed attempts. Try again at ${rateLimit.resetAt.toISOString()}`
          : 'Too many login attempts. Please try again later.',
        resetAt: rateLimit.resetAt,
        attemptsRemaining: rateLimit.remaining,
      });
    }

    // === FIND USER ===
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [
      email.toLowerCase(),
    ]);

    if (result.rows.length === 0) {
      logger.logSecurityEvent('Failed login - user not found', {
        email,
        ip: clientIP,
      });

      // Don't reveal if user exists
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        attemptsRemaining: rateLimit.remaining - 1,
      });
    }

    const user = result.rows[0];

    // === VERIFY PASSWORD ===
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      logger.logSecurityEvent('Failed login - incorrect password', {
        userId: user.user_id,
        email,
        ip: clientIP,
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        attemptsRemaining: rateLimit.remaining - 1,
      });
    }

    // === CHECK EMAIL VERIFICATION ===
    if (
      !user.email_verified
      && process.env.REQUIRE_VERIFIED_EMAIL !== 'false'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address before logging in',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // === SUCCESSFUL LOGIN - RESET RATE LIMIT ===
    await RateLimiter.reset(rateLimitKey);

    // === GENERATE TOKENS ===
    const accessToken = TokenService.generateAccessToken(user);
    const refreshToken = TokenService.generateRefreshToken(user);

    // === STORE REFRESH TOKEN ===
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [user.user_id, refreshToken],
    );

    // === UPDATE LAST LOGIN ===
    await pool.query(
      'UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE user_id = $2',
      [clientIP, user.user_id],
    );

    // Log successful login
    await logAuditEvent({
      eventType: EVENT_TYPES.AUTH_LOGIN,
      userId: user.user_id,
      action: 'User logged in',
      entityType: 'user',
      entityId: user.user_id,
      metadata: {
        loginMethod: 'password',
      },
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      severity: SEVERITY.LOW,
    });

    // Return success response
    return res.json({
      success: true,
      data: {
        user: {
          id: user.user_id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: SECURITY_CONFIG.JWT.ACCESS_TOKEN_EXPIRY,
        },
      },
    });
  } catch (error) {
    logger.logError(error, { context: 'auth_login', email: req.body?.email });

    // Log the error in audit log
    await logAuditEvent({
      eventType: EVENT_TYPES.AUTH_FAILED_LOGIN,
      userId: null,
      action: 'Login error',
      entityType: 'user',
      entityId: req.body?.email,
      metadata: {
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      severity: SEVERITY.HIGH,
    });

    return res.status(500).json({
      success: false,
      message: 'Error logging in',
    });
  }
};

// ============================================================================
// EMAIL VERIFICATION ENDPOINT
// ============================================================================

const verifyEmail = async (req, res) => {
  const { token } = req.body;
  const userId = req.user?.user_id;

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Verification token is required',
    });
  }

  try {
    // Verify the email verification token
    const decoded = TokenService.verify(token, 'email_verification');

    if (decoded.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Invalid verification token',
      });
    }

    // Update user's email verification status
    await pool.query(
      'UPDATE users SET email_verified = true, updated_at = NOW() WHERE user_id = $1',
      [userId],
    );

    // Log successful verification
    await logAuditEvent({
      eventType: EVENT_TYPES.AUTH_EMAIL_VERIFIED,
      userId,
      action: 'Email verified',
      entityType: 'user',
      entityId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      severity: SEVERITY.LOW,
    });

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    logger.logError(error, {
      context: 'verifyEmail',
      userId,
      token: `${token.substring(0, 10)}...`,
    });

    res.status(400).json({
      success: false,
      message: 'Invalid or expired verification token',
    });
  }
};

// ============================================================================
// PHONE VERIFICATION ENDPOINT
// ============================================================================

const verifyPhone = async (req, res) => {
  const { otp } = req.body;
  const userId = req.user?.user_id;

  if (!otp) {
    return res.status(400).json({
      success: false,
      message: 'OTP is required',
    });
  }

  try {
    // Verify the phone OTP
    const result = await OTPService.verifyPhoneOTP(userId, otp);

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.message || 'Invalid OTP',
      });
    }

    // Update user's phone verification status
    await pool.query(
      'UPDATE users SET phone_verified = true, updated_at = NOW() WHERE user_id = $1',
      [userId],
    );

    // Log successful verification
    await logAuditEvent({
      eventType: EVENT_TYPES.AUTH_PHONE_VERIFIED,
      userId,
      action: 'Phone verified',
      entityType: 'user',
      entityId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      severity: SEVERITY.LOW,
    });

    res.json({
      success: true,
      message: 'Phone verified successfully',
    });
  } catch (error) {
    logger.logError(error, { context: 'verifyPhone', userId });

    res.status(400).json({
      success: false,
      message: 'Failed to verify phone number',
    });
  }
};

// Helper function to send email verification
const sendEmailVerification = async (email, otp) => {
  try {
    // Generate email verification token
    const token = TokenService.generateEmailVerificationToken(email);

    // TODO: Implement actual email sending
    // For now, just log the token (in production, use email service)
    logger.info('Email verification token generated', {
      email,
      token: `${token.substring(0, 20)}...`,
      otp: `${otp.substring(0, 4)}...`,
    });

    // In production, send actual email
    // await emailService.sendVerificationEmail(email, token, otp);
  } catch (error) {
    logger.logError(error, { context: 'sendEmailVerification', email });
  }
};

// Helper function to send phone verification
const sendPhoneVerification = async (phone, otp) => {
  try {
    // TODO: Implement actual SMS sending
    // For now, just log the OTP
    logger.info('Phone verification OTP generated', {
      phone: phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2'),
      otp: `${otp.substring(0, 2)}**`,
    });

    // In production, send actual SMS
    // await smsService.sendVerificationSMS(phone, otp);
  } catch (error) {
    logger.logError(error, { context: 'sendPhoneVerification', phone });
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  register,
  login,
  verifyEmail,
  verifyPhone,
  // Export services for use in other controllers
  RateLimiter,
  OTPService,
  PasswordService,
  TokenService,
  SECURITY_CONFIG,
  // Export constants for consistency
  EVENT_TYPES,
  SEVERITY,
};
