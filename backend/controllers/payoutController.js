const pool = require('../config/db');

// @desc    Get eligible members for payout (ROSCA)
// @route   GET /api/payouts/:chamaId/eligible
// @access  Private
const getEligibleMembers = async (req, res) => {
  try {
    const { chamaId } = req.params;

    // Logic: Members who haven't received a payout in this cycle/ever in active cycle
    // Simplified: Just return all embers ordered by rotation
    const result = await pool.query(
      `SELECT cm.*, u.first_name, u.last_name 
             FROM chama_members cm
             JOIN users u ON cm.user_id = u.user_id
             WHERE cm.chama_id = $1 AND cm.is_active = true
             ORDER BY cm.rotation_position ASC`,
      [chamaId],
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get eligible error:', error);
    res.status(500).json({ success: false, message: 'Error fetching eligible members' });
  }
};

// @desc    Process a payout
// @route   POST /api/payouts/:chamaId/process
// @access  Private (Officials Only)
const processPayout = async (req, res) => {
  const client = await pool.connect();
  try {
    const { chamaId } = req.params;
    const {
      userId, amount, meetingId, notes,
    } = req.body;

    await client.query('BEGIN');

    // Check funds
    const chamaRes = await client.query('SELECT current_fund FROM chamas WHERE chama_id = $1', [chamaId]);
    if (chamaRes.rows[0].current_fund < parseFloat(amount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Insufficient funds for payout' });
    }

    // Record payout
    const result = await client.query(
      `INSERT INTO payouts (chama_id, user_id, amount, meeting_id, notes, status)
             VALUES ($1, $2, $3, $4, $5, 'COMPLETED')
             RETURNING *`,
      [chamaId, userId, amount, meetingId, notes],
    );

    // Deduct from Chama
    await client.query(
      'UPDATE chamas SET current_fund = current_fund - $1 WHERE chama_id = $2',
      [amount, chamaId],
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Payout processed successfully',
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Process payout error:', error);
    res.status(500).json({ success: false, message: 'Error processing payout' });
  } finally {
    client.release();
  }
};

// @desc    Get payout history
// @route   GET /api/payouts/:chamaId
// @access  Private
const getChamaPayouts = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const result = await pool.query(
      `SELECT p.*, u.first_name, u.last_name 
             FROM payouts p
             JOIN users u ON p.user_id = u.user_id
             WHERE p.chama_id = $1
             ORDER BY p.created_at DESC`,
      [chamaId],
    );
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get payouts error:', error);
    res.status(500).json({ success: false, message: 'Error fetching payouts' });
  }
};

module.exports = {
  getEligibleMembers,
  processPayout,
  getChamaPayouts,
};
