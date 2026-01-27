const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (
    req.headers.authorization
    && req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const result = await pool.query(
      'SELECT user_id, email, first_name, last_name, phone_number FROM users WHERE user_id = $1',
      [decoded.id],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    // Attach user to request object
    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token failed',
    });
  }
};

// Generic Authorize Middleware (Role based)
const authorize = (...roles) => async (req, res, next) => {
  try {
    // If we don't have a chamaId, we can't strictly check chama-specific roles via middleware
    // unless we do complex lookups. For now, rely on Controller for non-chamaId routes.
    if (!req.params.chamaId) {
      return next();
    }

    const { chamaId } = req.params;
    const userId = req.user.user_id;

    const result = await pool.query(
      'SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true',
      [chamaId, userId],
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this chama',
      });
    }

    const userRole = result.rows[0].role;

    // If roles includes 'MEMBER', any valid member passes
    if (roles.includes('MEMBER')) {
      req.memberRole = userRole;
      return next();
    }

    // 'ADMIN' is often a shorthand for Officials
    if (roles.includes('ADMIN')) {
      if (['CHAIRPERSON', 'SECRETARY', 'TREASURER'].includes(userRole)) {
        req.memberRole = userRole;
        return next();
      }
    }

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `User role ${userRole} is not authorized to access this route`,
      });
    }

    req.memberRole = userRole;
    next();
  } catch (error) {
    console.error('Authorization error:', error);
    res.status(500).json({ success: false, message: 'Authorization failed' });
  }
};

// Check if user is a chama official (Chairperson, Secretary, or Treasurer)
const isOfficial = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const userId = req.user.user_id;

    const result = await pool.query(
      'SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true',
      [chamaId, userId],
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this chama',
      });
    }

    const { role } = result.rows[0];
    if (!['CHAIRPERSON', 'SECRETARY', 'TREASURER'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Only chama officials can perform this action',
      });
    }

    req.memberRole = role;
    next();
  } catch (error) {
    console.error('Authorization error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking authorization',
    });
  }
};

// Check if user is treasurer
const isTreasurer = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const userId = req.user.user_id;

    const result = await pool.query(
      'SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true',
      [chamaId, userId],
    );

    if (result.rows.length === 0 || result.rows[0].role !== 'TREASURER') {
      return res.status(403).json({
        success: false,
        message: 'Only the treasurer can perform this action',
      });
    }

    next();
  } catch (error) {
    console.error('Authorization error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking authorization',
    });
  }
};

module.exports = {
  protect, isOfficial, isTreasurer, authorize,
};
