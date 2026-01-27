const pool = require('../config/db');

const chamaMember = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const userId = req.user?.user_id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const memberCheck = await pool.query(
      'SELECT * FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND status = $3',
      [chamaId, userId, 'active'],
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a member of this chama.',
      });
    }

    // Attach member info to request object for use in route handlers
    req.chamaMember = memberCheck.rows[0];
    next();
  } catch (error) {
    console.error('Error in chamaMember middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying chama membership',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = chamaMember;
