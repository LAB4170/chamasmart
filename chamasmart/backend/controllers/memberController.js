const pool = require('../config/db');
const { isValidRole } = require('../utils/validators');

// @desc    Add member to chama
// @route   POST /api/members/:chamaId/add
// @access  Private (Officials only)
const addMember = async (req, res) => {
  const client = await pool.connect();

  try {
    const { chamaId } = req.params;
    const { userId, role = 'MEMBER' } = req.body;

    if (!userId) {
      console.error('❌ AddMember: User ID is missing from body');
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    if (!isValidRole(role)) {
      console.error(`❌ AddMember: Invalid role '${role}'`);
      return res.status(400).json({
        success: false,
        message: 'Invalid role',
      });
    }

    // Check if user exists
    const userExists = await client.query(
      'SELECT user_id FROM users WHERE user_id = $1',
      [userId],
    );

    if (userExists.rows.length === 0) {
      console.error(`❌ AddMember: User with ID ${userId} not found in DB`);
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if already a member
    const memberExists = await client.query(
      'SELECT * FROM chama_members WHERE chama_id = $1 AND user_id = $2',
      [chamaId, userId],
    );

    if (memberExists.rows.length > 0) {
      console.error(`❌ AddMember: User ${userId} is already a member of Chama ${chamaId}`);
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this chama',
      });
    }

    await client.query('BEGIN');

    // Get next rotation position
    const positionResult = await client.query(
      'SELECT COALESCE(MAX(rotation_position), 0) + 1 as next_position FROM chama_members WHERE chama_id = $1',
      [chamaId],
    );
    const rotationPosition = positionResult.rows[0].next_position;

    // Add member
    const result = await client.query(
      `INSERT INTO chama_members (chama_id, user_id, role, rotation_position)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [chamaId, userId, role, rotationPosition],
    );

    // Update chama member count
    await client.query(
      'UPDATE chamas SET total_members = total_members + 1 WHERE chama_id = $1',
      [chamaId],
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Member added successfully',
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add member error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding member',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

// @desc    Update member role
// @route   PUT /api/members/:chamaId/role/:userId
// @access  Private (Officials only)
const updateMemberRole = async (req, res) => {
  try {
    const { chamaId, userId } = req.params;
    const { role } = req.body;

    if (!role || !isValidRole(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role is required',
      });
    }

    // Check if member exists
    const memberCheck = await pool.query(
      'SELECT * FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true',
      [chamaId, userId],
    );

    if (memberCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in this chama',
      });
    }

    // Update role
    const result = await pool.query(
      'UPDATE chama_members SET role = $1 WHERE chama_id = $2 AND user_id = $3 RETURNING *',
      [role, chamaId, userId],
    );

    res.json({
      success: true,
      message: 'Member role updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating member role',
    });
  }
};

// @desc    Remove member from chama
// @route   DELETE /api/members/:chamaId/remove/:userId
// @access  Private (Officials only)
const removeMember = async (req, res) => {
  const client = await pool.connect();

  try {
    const { chamaId, userId } = req.params;

    // Check if member exists
    const memberCheck = await client.query(
      'SELECT * FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true',
      [chamaId, userId],
    );

    if (memberCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in this chama',
      });
    }

    // Cannot remove if they're the only chairperson
    if (memberCheck.rows[0].role === 'CHAIRPERSON') {
      const chairpersonCount = await client.query(
        'SELECT COUNT(*) FROM chama_members WHERE chama_id = $1 AND role = $2 AND is_active = true',
        [chamaId, 'CHAIRPERSON'],
      );

      if (parseInt(chairpersonCount.rows[0].count) === 1) {
        return res.status(400).json({
          success: false,
          message:
            'Cannot remove the only chairperson. Assign a new chairperson first.',
        });
      }
    }

    await client.query('BEGIN');

    // Deactivate member
    await client.query(
      'UPDATE chama_members SET is_active = false WHERE chama_id = $1 AND user_id = $2',
      [chamaId, userId],
    );

    // Update chama member count
    await client.query(
      'UPDATE chamas SET total_members = total_members - 1 WHERE chama_id = $1',
      [chamaId],
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Remove member error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing member',
    });
  } finally {
    client.release();
  }
};

// @desc    Get member's contribution history
// @route   GET /api/members/:chamaId/contributions/:userId
// @access  Private
const getMemberContributions = async (req, res) => {
  try {
    const { chamaId, userId } = req.params;

    const result = await pool.query(
      `SELECT c.*, u.first_name || ' ' || u.last_name as recorded_by_name
       FROM contributions c
       LEFT JOIN users u ON c.recorded_by = u.user_id
       WHERE c.chama_id = $1 AND c.user_id = $2
       ORDER BY c.contribution_date DESC`,
      [chamaId, userId],
    );

    // Calculate total
    const total = result.rows.reduce(
      (sum, contrib) => sum + parseFloat(contrib.amount),
      0,
    );

    res.json({
      success: true,
      count: result.rows.length,
      totalAmount: total,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get member contributions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching contributions',
    });
  }
};

module.exports = {
  addMember,
  updateMemberRole,
  removeMember,
  getMemberContributions,
};
