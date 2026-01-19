/**
 * Auth Controller v2 - Multi-Option Signup
 * Supports: Email OTP, Phone OTP, Google OAuth, Passwordless
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const pool = require("../config/db");
const redis = require("../config/redis");
const logger = require("../utils/logger");
const {
  isValidEmail,
  isValidPhone,
  isStrongPassword,
} = require("../utils/validators");

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function maskEmail(email) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone) {
  return `${phone.slice(0, 4)}****${phone.slice(-2)}`;
}

function generateOTP(length = 6) {
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }
  return code;
}

function generateSignupToken() {
  return crypto.randomBytes(32).toString("hex");
}

function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user.user_id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "1h" },
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.user_id },
    process.env.JWT_REFRESH_SECRET || "refresh-secret",
    { expiresIn: "7d" },
  );
}

async function sendOTPEmail(email, otp) {
  try {
    // TODO: Integrate with SendGrid, AWS SES, or nodemailer
    logger.info("📧 OTP Email sent", {
      email: maskEmail(email),
      otp: process.env.NODE_ENV === "development" ? otp : "***",
    });

    // For now, log to Redis for development
    await redis.setex(`otp:email:${email}`, 600, otp); // Valid for 10 minutes

    return true;
  } catch (error) {
    logger.error("Failed to send OTP email", error);
    return false;
  }
}

async function sendOTPSMS(phone, otp) {
  try {
    // TODO: Integrate with Twilio, Africa's Talking, or similar
    logger.info("📱 OTP SMS sent", {
      phone: maskPhone(phone),
      otp: process.env.NODE_ENV === "development" ? otp : "***",
    });

    // For now, log to Redis for development
    await redis.setex(`otp:phone:${phone}`, 600, otp); // Valid for 10 minutes

    return true;
  } catch (error) {
    logger.error("Failed to send OTP SMS", error);
    return false;
  }
}

// ============================================================================
// STEP 1: INITIATE SIGNUP (Email, Phone, or Google)
// ============================================================================

const signupStart = async (req, res, next) => {
  try {
    const { email, phone, name, authMethod } = req.body;

    if (!authMethod || !["email", "phone", "google"].includes(authMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid auth method. Use: email, phone, or google",
      });
    }

    // Validate email if using email auth
    if (authMethod === "email") {
      if (!email || !isValidEmail(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email address",
        });
      }

      // Check if user already exists
      const existing = await pool.query(
        "SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)",
        [email],
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Email already registered. Please login.",
        });
      }
    }

    // Validate phone if using phone auth
    if (authMethod === "phone") {
      if (!phone || !isValidPhone(phone)) {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number",
        });
      }

      // Check if user already exists
      const existing = await pool.query(
        "SELECT user_id FROM users WHERE phone_number = $1",
        [phone],
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Phone number already registered. Please login.",
        });
      }
    }

    // Generate OTP and signup token
    const otp = generateOTP(6);
    const signupToken = generateSignupToken();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store signup session in Redis (15 minutes expiry)
    const sessionData = {
      email: email || null,
      phone: phone || null,
      name: name || null,
      authMethod,
      otp,
      otpExpiry: otpExpiry.toISOString(),
      createdAt: new Date().toISOString(),
    };

    await redis.setex(
      `signup:${signupToken}`,
      900, // 15 minutes
      JSON.stringify(sessionData),
    );

    // Send OTP
    if (authMethod === "email") {
      await sendOTPEmail(email, otp);
    } else if (authMethod === "phone") {
      await sendOTPSMS(phone, otp);
    }

    // Log attempt
    logger.info("✅ Signup initiated", {
      authMethod,
      contact: authMethod === "email" ? maskEmail(email) : maskPhone(phone),
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `OTP sent to ${authMethod === "email" ? email : phone}`,
      data: {
        signupToken,
        expiresIn: 600, // 10 minutes
        contact: authMethod === "email" ? maskEmail(email) : maskPhone(phone),
      },
    });
  } catch (error) {
    logger.error("Signup start error", error);
    next(error);
  }
};

// ============================================================================
// STEP 2: VERIFY OTP AND CREATE ACCOUNT
// ============================================================================

const signupVerifyOTP = async (req, res, next) => {
  try {
    const { signupToken, otp, password } = req.body;

    if (!signupToken || !otp) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: signupToken, otp",
      });
    }

    // Retrieve signup session from Redis
    const sessionData = await redis.get(`signup:${signupToken}`);

    if (!sessionData) {
      return res.status(410).json({
        success: false,
        message: "Signup session expired. Please start over.",
      });
    }

    const session = JSON.parse(sessionData);

    // Verify OTP
    if (otp !== session.otp || new Date() > new Date(session.otpExpiry)) {
      // Log failed attempt
      await pool.query(
        `INSERT INTO otp_audit (contact_info, contact_type, otp_code, success, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          session.email || session.phone,
          session.email ? "email" : "phone",
          otp,
          false,
          req.ip,
          req.get("user-agent"),
        ],
      );

      return res.status(401).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Create user account
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const result = await pool.query(
      `INSERT INTO users (email, phone_number, first_name, password_hash, email_verified, phone_verified, auth_method, is_passwordless, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING user_id, email, phone_number, first_name, role`,
      [
        session.email?.toLowerCase() || null,
        session.phone || null,
        session.name,
        passwordHash,
        session.email ? true : false, // Email verified via OTP
        session.phone ? true : false, // Phone verified via OTP
        session.authMethod,
        !password, // Passwordless if no password provided
      ],
    );

    const user = result.rows[0];

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token in DB
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [user.user_id, refreshToken],
    );

    // Log successful OTP
    await pool.query(
      `INSERT INTO otp_audit (contact_info, contact_type, otp_code, success, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        session.email || session.phone,
        session.email ? "email" : "phone",
        otp,
        true,
        req.ip,
        req.get("user-agent"),
      ],
    );

    // Clear signup token from Redis
    await redis.del(`signup:${signupToken}`);

    // Log success
    logger.info("✅ User registered successfully", {
      userId: user.user_id,
      email: maskEmail(session.email || ""),
      authMethod: session.authMethod,
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: {
        user: {
          userId: user.user_id,
          email: user.email,
          phone: user.phone_number,
          name: user.first_name,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 3600, // 1 hour
        },
      },
    });
  } catch (error) {
    logger.error("OTP verification error", error);
    next(error);
  }
};

// ============================================================================
// STEP 3: GOOGLE OAUTH CALLBACK
// ============================================================================

const signupGoogle = async (req, res, next) => {
  try {
    const { googleToken } = req.body;

    if (!googleToken) {
      return res.status(400).json({
        success: false,
        message: "Google token required",
      });
    }

    // Verify Google token (in production, use google-auth-library)
    let googlePayload;
    try {
      const { OAuth2Client } = require("google-auth-library");
      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken: googleToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      googlePayload = ticket.getPayload();
    } catch (error) {
      logger.error("Google token verification failed", error);
      return res.status(401).json({
        success: false,
        message: "Invalid Google token",
      });
    }

    const { email, name, picture, sub: googleId } = googlePayload;

    // Check if user exists
    let userResult = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [email],
    );

    let user;

    if (userResult.rows.length === 0) {
      // Create new user
      userResult = await pool.query(
        `INSERT INTO users (email, first_name, google_id, auth_method, email_verified, created_at)
         VALUES ($1, $2, $3, 'google', true, NOW())
         RETURNING user_id, email, first_name, role`,
        [email.toLowerCase(), name, googleId],
      );
      user = userResult.rows[0];
      logger.info("✅ New user created via Google OAuth", {
        userId: user.user_id,
      });
    } else {
      user = userResult.rows[0];
      // Update Google ID if not set
      if (!user.google_id) {
        await pool.query("UPDATE users SET google_id = $1 WHERE user_id = $2", [
          googleId,
          user.user_id,
        ]);
      }
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Store refresh token
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [user.user_id, refreshToken],
    );

    // Update last login
    await pool.query(
      "UPDATE users SET last_login_at = NOW() WHERE user_id = $1",
      [user.user_id],
    );

    logger.info("✅ Google OAuth login successful", {
      userId: user.user_id,
      email: maskEmail(email),
    });

    res.json({
      success: true,
      message: "Signed in with Google",
      data: {
        user: {
          userId: user.user_id,
          email: user.email,
          name: user.first_name,
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 3600,
        },
      },
    });
  } catch (error) {
    logger.error("Google OAuth error", error);
    next(error);
  }
};

// ============================================================================
// RESEND OTP
// ============================================================================

const resendOTP = async (req, res, next) => {
  try {
    const { signupToken } = req.body;

    if (!signupToken) {
      return res.status(400).json({
        success: false,
        message: "signupToken is required",
      });
    }

    // Retrieve signup session
    const sessionData = await redis.get(`signup:${signupToken}`);

    if (!sessionData) {
      return res.status(410).json({
        success: false,
        message: "Signup session expired",
      });
    }

    const session = JSON.parse(sessionData);

    // Generate new OTP
    const newOtp = generateOTP(6);
    const newExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Update session
    session.otp = newOtp;
    session.otpExpiry = newExpiry.toISOString();

    await redis.setex(`signup:${signupToken}`, 900, JSON.stringify(session));

    // Send new OTP
    if (session.authMethod === "email") {
      await sendOTPEmail(session.email, newOtp);
    } else if (session.authMethod === "phone") {
      await sendOTPSMS(session.phone, newOtp);
    }

    logger.info("✅ OTP resent", {
      authMethod: session.authMethod,
      contact:
        session.authMethod === "email"
          ? maskEmail(session.email)
          : maskPhone(session.phone),
    });

    res.json({
      success: true,
      message: "OTP resent successfully",
      data: {
        expiresIn: 600,
      },
    });
  } catch (error) {
    logger.error("Resend OTP error", error);
    next(error);
  }
};

// ============================================================================
// REFRESH TOKEN ENDPOINT
// ============================================================================

const refreshAccessToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || "refresh-secret",
      );
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }

    // Check if token exists in DB and not revoked
    const tokenResult = await pool.query(
      "SELECT * FROM refresh_tokens WHERE token = $1 AND revoked_at IS NULL AND expires_at > NOW()",
      [refreshToken],
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Refresh token has been revoked or expired",
      });
    }

    // Get user
    const userResult = await pool.query(
      "SELECT user_id, email, role FROM users WHERE user_id = $1",
      [decoded.userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = userResult.rows[0];

    // Generate new access token
    const newAccessToken = generateAccessToken(user);

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        expiresIn: 3600,
      },
    });
  } catch (error) {
    logger.error("Token refresh error", error);
    next(error);
  }
};

module.exports = {
  signupStart,
  signupVerifyOTP,
  signupGoogle,
  resendOTP,
  refreshAccessToken,
};
