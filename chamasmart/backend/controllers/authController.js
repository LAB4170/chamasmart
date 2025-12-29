const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const {
  isValidEmail,
  isValidPhone,
  normalizePhone,
  isStrongPassword,
} = require("../utils/validators");

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};


const register = async (req, res) => {
  try {
    console.log("Registration request body:", req.body); // Debug log
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

    // Generate token
    const token = generateToken(user.user_id);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          id: user.user_id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phoneNumber: user.phone_number,
          createdAt: user.created_at,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Error registering user: " + error.message,
      error: error.message,
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  console.log('Login attempt with data:', { email: req.body.email });
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
    console.log('Checking password for user ID:', user.user_id);
    const isMatch = await bcrypt.compare(password, user.password_hash);
    console.log('Password match result:', isMatch);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate token
    const token = generateToken(user.user_id);

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user.user_id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phoneNumber: user.phone_number,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Login error details:', {
      error: error.message,
      stack: error.stack,
      email: req.body.email,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({
      success: false,
      message: "Error logging in: " + error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
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
    console.error("Get me error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user data",
    });
  }
};

module.exports = { register, login, getMe };
