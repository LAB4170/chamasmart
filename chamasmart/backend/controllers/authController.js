const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
























































































};  getCacheDuration,  cacheControlMiddleware,module.exports = {};  return `"${hash}"`;    .digest("hex");    .update(JSON.stringify(data))    .createHash("md5")  const hash = crypto  const crypto = require("crypto");const generateETag = (data) => { */ * Generate simple ETag for response/**};  next();  };    return originalJson.call(this, data);    res.set("Vary", "Accept-Encoding");    // Set common headers    }      res.set("Expires", "0");      res.set("Pragma", "no-cache");      res.set("Cache-Control", "no-cache, no-store, must-revalidate");      // Don't cache by default    } else {      res.set("ETag", generateETag(data));      }        res.set("Cache-Control", `private, max-age=${cacheDuration}`);        // Private cache for user-specific data      } else {        res.set("Cache-Control", `public, max-age=${cacheDuration}`);      if (req.path.includes("/chamas/public")) {      // Public cache for non-sensitive data    if (cacheDuration > 0) {    const cacheDuration = getCacheDuration(req);  res.json = function (data) {  // Override json method to set cache headers  const originalJson = res.json;  // Store original json methodconst cacheControlMiddleware = (req, res, next) => { */ * Cache control headers middleware/**};  return 0;  // Default - don't cache  }    return 300;  if (path.includes("chamas") || path.includes("meetings") || path.includes("contributions")) {  // List endpoints - cache for 5 minutes  }    return 300;  if (path.includes("/my-") || path.includes("/user/")) {  // User-specific data - cache for 5 minutes  }    return 3600;  if (path.includes("/chamas/public") || path.includes("/health")) {  // Public data - cache for 1 hour  }    return 0;  if (method !== "GET") {  // Don't cache non-GET requests  const { method, path } = req;const getCacheDuration = (req) => { */ * Determine cache duration based on endpoint and method/**const logger = require("../utils/logger"); */ * Sets appropriate caching headers based on response type and endpointconst crypto = require("crypto");
const {
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  revokeAllRefreshTokens,
} = require("../utils/tokenManager");

// Generate JWT token (DEPRECATED: use generateAccessToken)
const generateToken = (id) => {
  return generateAccessToken(id);
};

// Generate a numeric OTP code (e.g. 6 digits)
const generateOtpCode = (length = 6) => {
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    const idx = crypto.randomInt(0, digits.length);
    code += digits[idx];
  }
  return code;
};

// Very simple email transporter; expects SMTP config via env variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
});

const sendEmailVerification = async (toEmail, token) => {
  if (!process.env.SMTP_HOST) {
    logger.warn("SMTP not configured; skipping email verification send", {
      context: "auth_sendEmailVerification",
    });
    return;
  }

  const verifyUrl = `${process.env.FRONTEND_BASE_URL || "http://localhost:5173"}/verify-email?token=${encodeURIComponent(
    token
  )}`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || "no-reply@chamasmart.app",
    to: toEmail,
    subject: "Verify your ChamaSmart email",
    text: `Please verify your email by clicking the link: ${verifyUrl}`,
    html: `<p>Please verify your email by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
};

// Placeholder for phone OTP delivery (integrate with SMS provider in production)
const sendPhoneVerificationCode = async (phoneNumber, code) => {
  logger.info("Phone verification code generated", {
    context: "auth_sendPhoneVerificationCode",
    phoneNumber,
    // Do NOT log the actual code in production logs; this is for debugging only
    debug: process.env.NODE_ENV !== "production" ? { code } : undefined,
  });
  // TODO: Integrate with SMS/WhatsApp provider (e.g. Africa's Talking, Twilio)
};

const register = async (req, res) => {
  const isDev = process.env.NODE_ENV !== "production";
  try {
    const { email, password, firstName, lastName, phoneNumber, nationalId } =
      req.body;

    // Validation
    if (!email || !password || !firstName || !lastName || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Validate email
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Validate phone
    if (!isValidPhone(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid Kenyan phone number",
      });
    }

    // Validate password strength
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters with uppercase, lowercase, and number",
      });
    }

    // Normalize phone number
    const normalizedPhone = normalizePhone(phoneNumber);

    // Check if user exists
    const userExists = await pool.query(
      "SELECT * FROM users WHERE email = $1 OR phone_number = $2",
      [email.toLowerCase(), normalizedPhone]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "User with this email or phone number already exists",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone_number, national_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, email, first_name, last_name, phone_number, created_at`,
      [
        email.toLowerCase(),
        hashedPassword,
        firstName,
        lastName,
        normalizedPhone,
        nationalId || null,
      ]
    );

    const user = result.rows[0];

    // Generate and store email verification token (24h expiry)
    const emailToken = crypto.randomBytes(24).toString("hex");
    const emailExpiryHours = parseInt(
      process.env.EMAIL_VERIFICATION_EXPIRY_HOURS || "24",
      10
    );

    await pool.query(
      `UPDATE users
       SET email_verification_token = $1,
           email_verification_expires_at = NOW() + ($2 || ' hours')::INTERVAL,
           email_verification_last_sent_at = NOW()
       WHERE user_id = $3`,
      [emailToken, emailExpiryHours.toString(), user.user_id]
    );

    // Generate and store phone verification OTP (10 min expiry by default)
    const phoneCode = generateOtpCode(6);
    const phoneExpiryMinutes = parseInt(
      process.env.PHONE_VERIFICATION_EXPIRY_MINUTES || "10",
      10
    );

    await pool.query(
      `UPDATE users
       SET phone_verification_code = $1,
           phone_verification_expires_at = NOW() + ($2 || ' minutes')::INTERVAL,
           phone_verification_attempts = 0,
           phone_verification_last_sent_at = NOW()
       WHERE user_id = $3`,
      [phoneCode, phoneExpiryMinutes.toString(), user.user_id]
    );

    // Fire-and-forget send of verification channels (errors logged but do not break registration)
    try {
      await sendEmailVerification(user.email, emailToken);
    } catch (sendErr) {
      logger.logError(sendErr, { context: "auth_sendEmailVerification", email: user.email });
    }

    try {
      await sendPhoneVerificationCode(normalizedPhone, phoneCode);
    } catch (sendErr) {
      logger.logError(sendErr, {
        context: "auth_sendPhoneVerificationCode",
        phoneNumber: normalizedPhone,
      });
    }

    // Generate token (we still allow login immediately, but user is marked unverified)
    const token = generateToken(user.user_id);

    res.status(201).json({
      success: true,
      message: "User registered successfully. Please verify your email and phone.",
      data: {
        user: {
          id: user.user_id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phoneNumber: user.phone_number,
          createdAt: user.created_at,
          emailVerified: false,
          phoneVerified: false,
        },
        token,
      },
    });
  } catch (error) {
    logger.logError(error, {
      context: "auth_register",
      email: req.body?.email,
    });

    const isDev = process.env.NODE_ENV !== "production";
    const message = isDev
      ? `Error registering user: ${error.message}`
      : "Internal server error";

    res.status(500).json({
      success: false,
      message,
      ...(isDev && { error: error.message }),
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  const isDev = process.env.NODE_ENV !== "production";
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Check if user exists
    console.log('Querying database for user:', email.toLowerCase());
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    console.log('Database query result:', { rowCount: result.rows.length });

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const user = result.rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Require verified email before login when configured (default: true in production)
    const requireVerifiedEmail =
      process.env.REQUIRE_VERIFIED_EMAIL === "true" ||
      (process.env.NODE_ENV === "production" &&
        process.env.REQUIRE_VERIFIED_EMAIL !== "false");

    if (requireVerifiedEmail && user.email_verified === false) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email address before logging in",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    // Generate access token and refresh token
    const accessToken = generateAccessToken(user.user_id);
    const refreshToken = generateRefreshToken(user.user_id);

    // Store refresh token in database
    try {
      const userAgent = req.get("user-agent") || "unknown";
      const ipAddress = req.ip || req.connection.remoteAddress || "unknown";
      await storeRefreshToken(user.user_id, refreshToken, userAgent, ipAddress);
    } catch (tokenError) {
      logger.warn("Failed to store refresh token, but continuing login", {
        userId: user.user_id,
        error: tokenError.message,
      });
    }

    res.success(
      {
        user: {
          id: user.user_id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phoneNumber: user.phone_number,
        },
        accessToken,
        refreshToken,
      },
      "Login successful"
    );
  } catch (error) {
    logger.logError(error, {
      context: "auth_login",
      email: req.body?.email,
    });

    const message = isDev
      ? `Error logging in: ${error.message}`
      : "Internal server error";

    res.status(500).json({
      success: false,
      message,
      ...(isDev && { error: error.stack }),
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: {
          id: req.user.user_id,
          email: req.user.email,
          firstName: req.user.first_name,
          lastName: req.user.last_name,
          phoneNumber: req.user.phone_number,
        },
      },
    });
  } catch (error) {
    logger.logError(error, { context: "auth_getMe", userId: req.user?.user_id });
    res.status(500).json({
      success: false,
      message: "Error fetching user data",
    });
  }
};

// @desc    Verify email using token
// @route   POST /api/auth/verify-email
// @access  Public (token-based)
const verifyEmail = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: "Verification token is required" });
  }

  try {
    const result = await pool.query(
      `SELECT user_id, email_verification_expires_at, email_verified
       FROM users
       WHERE email_verification_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Invalid or expired verification token" });
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return res.json({ success: true, message: "Email already verified" });
    }

    if (user.email_verification_expires_at && new Date(user.email_verification_expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: "Verification token has expired" });
    }

    await pool.query(
      `UPDATE users
       SET email_verified = TRUE,
           email_verification_token = NULL,
           email_verification_expires_at = NULL
       WHERE user_id = $1`,
      [user.user_id]
    );

    return res.json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    logger.logError(error, { context: "auth_verifyEmail" });
    return res.status(500).json({ success: false, message: "Error verifying email" });
  }
};

// @desc    Resend email verification token (with cooldown)
// @route   POST /api/auth/resend-email-verification
// @access  Private
const resendEmailVerification = async (req, res) => {
  const userId = req.user.user_id;

  try {
    const result = await pool.query(
      `SELECT email, email_verified, email_verification_last_sent_at
       FROM users
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return res.json({ success: true, message: "Email already verified" });
    }

    const cooldownMinutes = parseInt(
      process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES || "5",
      10
    );

    if (user.email_verification_last_sent_at) {
      const lastSent = new Date(user.email_verification_last_sent_at);
      const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000);
      if (lastSent > cutoff) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${cooldownMinutes} minutes before requesting another verification email`,
        });
      }
    }

    const emailToken = crypto.randomBytes(24).toString("hex");
    const emailExpiryHours = parseInt(
      process.env.EMAIL_VERIFICATION_EXPIRY_HOURS || "24",
      10
    );

    await pool.query(
      `UPDATE users
       SET email_verification_token = $1,
           email_verification_expires_at = NOW() + ($2 || ' hours')::INTERVAL,
           email_verification_last_sent_at = NOW()
       WHERE user_id = $3`,
      [emailToken, emailExpiryHours.toString(), userId]
    );

    try {
      await sendEmailVerification(user.email, emailToken);
    } catch (sendErr) {
      logger.logError(sendErr, {
        context: "auth_resendEmailVerification",
        email: user.email,
      });
    }

    return res.json({ success: true, message: "Verification email resent" });
  } catch (error) {
    logger.logError(error, { context: "auth_resendEmailVerification", userId });
    return res
      .status(500)
      .json({ success: false, message: "Error resending verification email" });
  }
};

// @desc    Verify phone using OTP code
// @route   POST /api/auth/verify-phone
// @access  Private (requires auth)
const verifyPhone = async (req, res) => {
  const { code } = req.body;
  const userId = req.user.user_id;

  if (!code) {
    return res.status(400).json({ success: false, message: "Verification code is required" });
  }

  try {
    const result = await pool.query(
      `SELECT phone_verification_code, phone_verification_expires_at, phone_verification_attempts, phone_verified
       FROM users
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = result.rows[0];

    if (user.phone_verified) {
      return res.json({ success: true, message: "Phone number already verified" });
    }

    if (!user.phone_verification_code || !user.phone_verification_expires_at) {
      return res.status(400).json({ success: false, message: "No active verification code. Please request a new one." });
    }

    const now = new Date();
    if (new Date(user.phone_verification_expires_at) < now) {
      return res.status(400).json({ success: false, message: "Verification code has expired" });
    }

    if (user.phone_verification_attempts >= 5) {
      return res.status(429).json({ success: false, message: "Too many incorrect attempts. Please request a new code." });
    }

    if (code !== user.phone_verification_code) {
      await pool.query(
        `UPDATE users
         SET phone_verification_attempts = phone_verification_attempts + 1
         WHERE user_id = $1`,
        [userId]
      );

      return res.status(400).json({ success: false, message: "Invalid verification code" });
    }

    await pool.query(
      `UPDATE users
       SET phone_verified = TRUE,
           phone_verification_code = NULL,
           phone_verification_expires_at = NULL,
           phone_verification_attempts = 0
       WHERE user_id = $1`,
      [userId]
    );

    return res.json({ success: true, message: "Phone number verified successfully" });
  } catch (error) {
    logger.logError(error, { context: "auth_verifyPhone", userId });
    return res.status(500).json({ success: false, message: "Error verifying phone number" });
  }
};

// @desc    Resend phone verification OTP (with cooldown)
// @route   POST /api/auth/resend-phone-verification
// @access  Private
const resendPhoneVerification = async (req, res) => {
  const userId = req.user.user_id;

  try {
    const result = await pool.query(
      `SELECT phone_number, phone_verified, phone_verification_last_sent_at
       FROM users
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const user = result.rows[0];

    if (user.phone_verified) {
      return res.json({ success: true, message: "Phone number already verified" });
    }

    const cooldownMinutes = parseInt(
      process.env.PHONE_VERIFICATION_RESEND_COOLDOWN_MINUTES || "2",
      10
    );

    if (user.phone_verification_last_sent_at) {
      const lastSent = new Date(user.phone_verification_last_sent_at);
      const cutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000);
      if (lastSent > cutoff) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${cooldownMinutes} minutes before requesting another SMS code`,
        });
      }
    }

    const phoneCode = generateOtpCode(6);
    const phoneExpiryMinutes = parseInt(
      process.env.PHONE_VERIFICATION_EXPIRY_MINUTES || "10",
      10
    );

    await pool.query(
      `UPDATE users
       SET phone_verification_code = $1,
           phone_verification_expires_at = NOW() + ($2 || ' minutes')::INTERVAL,
           phone_verification_attempts = 0,
           phone_verification_last_sent_at = NOW()
       WHERE user_id = $3`,
      [phoneCode, phoneExpiryMinutes.toString(), userId]
    );

    try {
      await sendPhoneVerificationCode(user.phone_number, phoneCode);
    } catch (sendErr) {
      logger.logError(sendErr, {
        context: "auth_resendPhoneVerification",
        phoneNumber: user.phone_number,
      });
    }

    return res.json({ success: true, message: "Verification SMS resent" });
  } catch (error) {
    logger.logError(error, { context: "auth_resendPhoneVerification", userId });
    return res
      .status(500)
      .json({ success: false, message: "Error resending phone verification code" });
  }
};

// @desc    Refresh access token using refresh token
// @route   POST /api/auth/refresh
// @access  Public
const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.error("Refresh token required", 400);
    }

    // Decode the token to get user ID
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.error("Invalid or expired refresh token", 401);
    }

    if (decoded.type !== "refresh") {
      return res.error("Invalid token type", 401);
    }

    const userId = decoded.id;

    // Verify token exists in database
    try {
      await verifyRefreshToken(userId, refreshToken);
    } catch (error) {
      return res.error("Refresh token not found or revoked", 401);
    }

    // Get user info
    const userResult = await pool.query(
      "SELECT user_id, email, first_name, last_name, phone_number FROM users WHERE user_id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.error("User not found", 404);
    }

    const user = userResult.rows[0];

    // Generate new access token
    const newAccessToken = generateAccessToken(userId);

    // Optionally generate new refresh token (rotate tokens for better security)
    const newRefreshToken = generateRefreshToken(userId);
    const userAgent = req.get("user-agent") || "unknown";
    const ipAddress = req.ip || req.connection.remoteAddress || "unknown";

    await storeRefreshToken(userId, newRefreshToken, userAgent, ipAddress);

    res.success(
      {
        user: {
          id: user.user_id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phoneNumber: user.phone_number,
        },
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
      "Token refreshed successfully"
    );
  } catch (error) {
    logger.error("Token refresh error", { error: error.message });
    res.error("Error refreshing token", 500);
  }
};

// @desc    Logout user (revoke all refresh tokens)
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Revoke all refresh tokens for this user
    await revokeAllRefreshTokens(userId);

    logger.info("User logged out", { userId });

    res.success(null, "Logged out successfully");
  } catch (error) {
    logger.error("Logout error", { userId: req.user.user_id, error: error.message });
    res.error("Error logging out", 500);
  }
};

module.exports = {
  register,
  login,
  getMe,
  verifyEmail,
  verifyPhone,
  resendEmailVerification,
  resendPhoneVerification,
  refresh,
  logout,
};
