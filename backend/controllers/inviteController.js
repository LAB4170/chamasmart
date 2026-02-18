const crypto = require('crypto');
const pool = require('../config/db');

// Generate unique invite code
const generateInviteCode = () => crypto.randomBytes(4).toString('hex').toUpperCase() // e.g., "A3F2B9C1"
  ;

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
        [inviteCode],
      );
      if (exists.rows.length === 0) {
        isUnique = true;
      }
    }

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays));

    // Create invite
    const result = await pool.query(
      `INSERT INTO chama_invites (chama_id, invite_code, created_by, max_uses, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [chamaId, inviteCode, req.user.user_id, maxUses, expiresAt],
    );

    res.status(201).json({
      success: true,
      message: 'Invite code generated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Generate invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating invite code',
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
        message: 'Invite code is required',
      });
    }

    await client.query('BEGIN');

    // Find and validate invite
    const inviteResult = await client.query(
      `SELECT * FROM chama_invites 
       WHERE invite_code = $1 AND is_active = true`,
      [inviteCode.toUpperCase()],
    );

    if (inviteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invite code',
      });
    }

    const invite = inviteResult.rows[0];

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await client.query(
        'UPDATE chama_invites SET is_active = false WHERE invite_id = $1',
        [invite.invite_id],
      );
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'This invite code has expired',
      });
    }

    // Check if max uses reached
    if (invite.uses_count >= invite.max_uses) {
      await client.query(
        'UPDATE chama_invites SET is_active = false WHERE invite_id = $1',
        [invite.invite_id],
      );
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'This invite code has reached its maximum uses',
      });
    }

    // Check if user is already a member
    const memberCheck = await client.query(
      'SELECT * FROM chama_members WHERE chama_id = $1 AND user_id = $2',
      [invite.chama_id, userId],
    );

    if (memberCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'You are already a member of this chama',
      });
    }

    // Get next rotation position
    const positionResult = await client.query(
      'SELECT COALESCE(MAX(rotation_position), 0) + 1 as next_position FROM chama_members WHERE chama_id = $1',
      [invite.chama_id],
    );
    const rotationPosition = positionResult.rows[0].next_position;

    // Add user to chama
    const memberResult = await client.query(
      `INSERT INTO chama_members (chama_id, user_id, role, rotation_position)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [invite.chama_id, userId, role, rotationPosition],
    );

    // Update chama member count
    await client.query(
      'UPDATE chamas SET total_members = total_members + 1 WHERE chama_id = $1',
      [invite.chama_id],
    );

    // Update invite usage count
    await client.query(
      'UPDATE chama_invites SET uses_count = uses_count + 1 WHERE invite_id = $1',
      [invite.invite_id],
    );

    // Deactivate if max uses reached
    if (invite.uses_count + 1 >= invite.max_uses) {
      await client.query(
        'UPDATE chama_invites SET is_active = false WHERE invite_id = $1',
        [invite.invite_id],
      );
    }

    // Get chama details
    const chamaResult = await client.query(
      'SELECT * FROM chamas WHERE chama_id = $1',
      [invite.chama_id],
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Successfully joined the chama!',
      data: {
        membership: memberResult.rows[0],
        chama: chamaResult.rows[0],
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Join with invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Error joining chama',
      error: error.message,
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
      [chamaId],
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get invites error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invites',
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
      [inviteId],
    );

    res.json({
      success: true,
      message: 'Invite code deactivated',
    });
  } catch (error) {
    console.error('Deactivate invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating invite',
    });
  }
};

const { sendInviteEmail } = require('../utils/emailService');

// @desc    Send email invitation or add existing user directly
// @route   POST /api/invites/:chamaId/send
// @access  Private (Officials only)
const sendInvite = async (req, res) => {
  const client = await pool.connect();

  try {
    const { chamaId } = req.params;
    const { email, role = 'MEMBER' } = req.body;
    const inviterName = `${req.user.first_name} ${req.user.last_name}`;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    await client.query('BEGIN');

    // 1. Get Chama Details
    const chamaRes = await client.query('SELECT chama_name, is_active FROM chamas WHERE chama_id = $1', [chamaId]);
    if (chamaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Chama not found' });
    }
    const { chama_name: chamaName, is_active: isActive } = chamaRes.rows[0];

    if (!isActive) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Chama is not active' });
    }

    // 2. Check if user already exists on the platform
    const userCheck = await client.query('SELECT user_id, first_name FROM users WHERE email = $1', [email]);

    if (userCheck.rows.length > 0) {
      const existingUser = userCheck.rows[0];
      const targetUserId = existingUser.user_id;

      // Check if already a member
      const memberCheck = await client.query(
        'SELECT is_active FROM chama_members WHERE chama_id = $1 AND user_id = $2',
        [chamaId, targetUserId]
      );

      if (memberCheck.rows.length > 0) {
        if (memberCheck.rows[0].is_active) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: `${email} is already an active member of this chama.`,
          });
        } else {
          // Reactivate
          await client.query(
            'UPDATE chama_members SET is_active = true, role = $1, join_date = NOW() WHERE chama_id = $2 AND user_id = $3',
            [role, chamaId, targetUserId]
          );
        }
      } else {
        // Add as new member
        // Get next rotation position
        const posRes = await client.query(
          'SELECT COALESCE(MAX(rotation_position), 0) + 1 as next_pos FROM chama_members WHERE chama_id = $1',
          [chamaId]
        );
        const nextPosition = posRes.rows[0].next_pos;

        await client.query(
          `INSERT INTO chama_members (chama_id, user_id, role, rotation_position)
           VALUES ($1, $2, $3, $4)`,
          [chamaId, targetUserId, role, nextPosition]
        );
      }

      // Update total members
      await client.query(
        'UPDATE chamas SET total_members = total_members + 1 WHERE chama_id = $1',
        [chamaId]
      );

      // Send application notification
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
         VALUES ($1, 'MEMBER_ADDED', 'Joined ${chamaName}', 'You have been added to ${chamaName} by ${inviterName}', 'CHAMA', $2)`,
        [targetUserId, chamaId]
      );

      await client.query('COMMIT');

      return res.json({
        success: true,
        message: `${existingUser.first_name} has been added to the chama directly.`,
        isAdded: true,
      });
    }

    // 3. User doesn't exist - Generate Invite Code & Send Email
    let inviteCode;
    let isUnique = false;

    while (!isUnique) {
      inviteCode = generateInviteCode();
      const exists = await client.query(
        'SELECT invite_id FROM chama_invites WHERE invite_code = $1',
        [inviteCode]
      );
      if (exists.rows.length === 0) {
        isUnique = true;
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await client.query(
      `INSERT INTO chama_invites (chama_id, invite_code, created_by, max_uses, expires_at)
       VALUES ($1, $2, $3, 1, $4)`,
      [chamaId, inviteCode, req.user.user_id, expiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteLink = `${frontendUrl}/join-chama?code=${inviteCode}`;

    const emailResult = await sendInviteEmail(email, inviteLink, chamaName, inviterName);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: emailResult.mode === 'CONSOLE'
        ? `Invitation simulated for ${email} (Console Mode)`
        : `Invitation email sent to ${email}`,
      isAdded: false,
      deliveryMode: emailResult.mode
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Send invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process invitation',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  generateInvite,
  joinWithInvite,
  getChamaInvites,
  deactivateInvite,
  sendInvite,
};
