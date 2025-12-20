const pool = require('../config/db');
const crypto = require('crypto');

// Generate unique invite code
const generateInviteCode = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g., "A3F2B9C1"
};

// @desc    Generate invite code for chama
// @route   POST /api/invites/:chamaId/generate
// @access  Private (Officials only)
const generateInvite = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const { maxUses = 1, expiresInDays = 7 } = req.body;

    // Generate unique code
    let inviteCode;
    let isUnique = false;
    
    while (!isUnique) {
      inviteCode = generateInviteCode();
      const exists = await pool.query(
        'SELECT invite_id FROM chama_invites WHERE invite_code = $1',
        [inviteCode]
      );
      if (exists.rows.length === 0) {
        isUnique = true;
      }
    }

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create invite
    const result = await pool.query(
      `INSERT INTO chama_invites (chama_id, invite_code, created_by, max_uses, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [chamaId, inviteCode, req.user.user_id, maxUses, expiresAt]
    );

    res.status(201).json({
      success: true,
      message: 'Invite code generated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Generate invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating invite code'
    });
  }
};

// @desc    Join chama using invite code
// @route   POST /api/invites/join
// @access  Private
const joinWithInvite = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { inviteCode, role = 'MEMBER' } = req.body;
    const userId = req.user.user_id;

    if (!inviteCode) {
      return res.status(400).json({
        success: false,
        message: 'Invite code is required'
      });
    }

    await client.query('BEGIN');

    // Find and validate invite
    const inviteResult = await client.query(
      `SELECT * FROM chama_invites 
       WHERE invite_code = $1 AND is_active = true`,
      [inviteCode.toUpperCase()]
    );

    if (inviteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invite code'
      });
    }

    const invite = inviteResult.rows[0];

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await client.query(
        'UPDATE chama_invites SET is_active = false WHERE invite_id = $1',
        [invite.invite_id]
      );
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'This invite code has expired'
      });
    }

    // Check if max uses reached
    if (invite.uses_count >= invite.max_uses) {
      await client.query(
        'UPDATE chama_invites SET is_active = false WHERE invite_id = $1',
        [invite.invite_id]
      );
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'This invite code has reached its maximum uses'
      });
    }

    // Check if user is already a member
    const memberCheck = await client.query(
      'SELECT * FROM chama_members WHERE chama_id = $1 AND user_id = $2',
      [invite.chama_id, userId]
    );

    if (memberCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this chama'
      });
    }

    // Get next rotation position
    const positionResult = await client.query(
      'SELECT COALESCE(MAX(rotation_position), 0) + 1 as next_position FROM chama_members WHERE chama_id = $1',
      [invite.chama_id]
    );
    const rotationPosition = positionResult.rows[0].next_position;

    // Add user to chama
    const memberResult = await client.query(
      `INSERT INTO chama_members (chama_id, user_id, role, rotation_position)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [invite.chama_id, userId, role, rotationPosition]
    );

    // Update chama member count
    await client.query(
      'UPDATE chamas SET total_members = total_members + 1 WHERE chama_id = $1',
      [invite.chama_id]
    );

    // Update invite usage count
    await client.query(
      'UPDATE chama_invites SET uses_count = uses_count + 1 WHERE invite_id = $1',
      [invite.invite_id]
    );

    // Deactivate if max uses reached
    if (invite.uses_count + 1 >= invite.max_uses) {
      await client.query(
        'UPDATE chama_invites SET is_active = false WHERE invite_id = $1',
        [invite.invite_id]
      );
    }

    // Get chama details
    const chamaResult = await client.query(
      'SELECT * FROM chamas WHERE chama_id = $1',
      [invite.chama_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Successfully joined the chama!',
      data: {
        membership: memberResult.rows[0],
        chama: chamaResult.rows[0]
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Join with invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Error joining chama',
      error: error.message
    });
  } finally {
    client.release();
  }
};

// @desc    Get chama invites
// @route   GET /api/invites/:chamaId
// @access  Private (Officials only)
const getChamaInvites = async (req, res) => {
  try {
    const { chamaId } = req.params;

    const result = await pool.query(
      `SELECT i.*, u.first_name || ' ' || u.last_name as created_by_name
       FROM chama_invites i
       LEFT JOIN users u ON i.created_by = u.user_id
       WHERE i.chama_id = $1
       ORDER BY i.created_at DESC`,
      [chamaId]
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Get invites error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invites'
    });
  }
};

// @desc    Deactivate invite
// @route   DELETE /api/invites/:inviteId
// @access  Private (Officials only)
const deactivateInvite = async (req, res) => {
  try {
    const { inviteId } = req.params;

    await pool.query(
      'UPDATE chama_invites SET is_active = false WHERE invite_id = $1',
      [inviteId]
    );

    res.json({
      success: true,
      message: 'Invite code deactivated'
    });
  } catch (error) {
    console.error('Deactivate invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating invite'
    });
  }
};

module.exports = {
  generateInvite,
  joinWithInvite,
  getChamaInvites,
  deactivateInvite
};
