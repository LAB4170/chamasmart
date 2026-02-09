const NodeCache = require('node-cache');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { getIo } = require('../socket');
const logger = require('../utils/logger');
const { isValidAmount } = require('../utils/validators');

// Initialize cache
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * @desc    Create a new ROSCA cycle
 * @route   POST /api/rosca/cycles
 * @access  Private (Admin/Officials)
 */
const createCycle = async (req, res) => {
  const client = await pool.connect();
  const {
    chama_id, cycle_name, contribution_amount, frequency, start_date, roster_method = 'RANDOM', manual_roster = [],
  } = req.body;
  const userId = req.user.user_id;

  try {
    // Validate input
    if (!chama_id || !cycle_name || !contribution_amount || !frequency || !start_date) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!['WEEKLY', 'BIWEEKLY', 'MONTHLY'].includes(frequency)) {
      return res.status(400).json({ success: false, message: 'Invalid frequency' });
    }

    if (!isValidAmount(contribution_amount)) {
      return res.status(400).json({ success: false, message: 'Contribution amount must be a positive number' });
    }

    const parsedContributionAmount = parseFloat(contribution_amount);

    await client.query('BEGIN');

    // Check if user is admin/treasurer of the chama
    const chamaCheck = await client.query(
      `SELECT 1 FROM chama_members 
             WHERE chama_id = $1 AND user_id = $2 AND role IN ('CHAIRPERSON', 'TREASURER', 'SECRETARY')`,
      [chama_id, userId],
    );

    if (chamaCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Not authorized to create cycles for this chama' });
    }

    // Create the cycle
    const cycleResult = await client.query(
      `INSERT INTO rosca_cycles 
             (chama_id, cycle_name, contribution_amount, frequency, start_date, status)
             VALUES ($1, $2, $3, $4, $5, 'PENDING')
             RETURNING *`,
      [chama_id, cycle_name, parsedContributionAmount, frequency, new Date(start_date)],
    );

    const cycle = cycleResult.rows[0];

    // Get active members
    const members = await client.query(
      `SELECT user_id FROM chama_members 
             WHERE chama_id = $1 AND is_active = true`,
      [chama_id],
    );

    if (members.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'No active members in chama' });
    }

    if (members.rows.length < 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'At least two active members are required for a ROSCA cycle' });
    }

    // Generate Roster based on method
    let rosterMembers = [];

    if (roster_method === 'MANUAL') {
      // Validate manual roster
      if (!manual_roster || manual_roster.length !== members.rows.length) {
        throw new Error('Manual roster must include all active members');
      }

      // Verify all members are present
      const memberIds = members.rows.map(m => m.user_id);
      const allPresent = manual_roster.every(id => memberIds.includes(id));
      if (!allPresent) {
        throw new Error('Invalid member ID in manual roster');
      }

      rosterMembers = manual_roster.map(userId => members.rows.find(m => m.user_id === userId));
    } else if (roster_method === 'TRUST') {
      // Fetch members with trust scores
      const membersWithScores = await client.query(
        `SELECT user_id, COALESCE(trust_score, 50) as trust_score 
                 FROM users 
                 WHERE user_id = ANY($1)`,
        [members.rows.map(m => m.user_id)],
      );

      const scoredMembers = membersWithScores.rows;

      // Challenge A: "Trust-Based Roster"
      // > 80: High Trust (First slots)
      // < 60: Low Trust (Last slots)
      const highTrust = scoredMembers.filter(m => m.trust_score >= 80);
      const lowTrust = scoredMembers.filter(m => m.trust_score < 60);
      const midTrust = scoredMembers.filter(m => m.trust_score >= 60 && m.trust_score < 80);

      // Shuffle within tiers for fairness
      const shuffle = arr => arr.sort(() => 0.5 - Math.random());

      rosterMembers = [
        ...shuffle(highTrust),
        ...shuffle(midTrust),
        ...shuffle(lowTrust),
      ];
    } else {
      // RANDOM (Default)
      rosterMembers = [...members.rows].sort(() => 0.5 - Math.random());
    }

    const rosterValues = [];
    const rosterParams = [];

    rosterMembers.forEach((member, index) => {
      const payoutAmount = parsedContributionAmount * (members.rows.length - 1);
      // (cycle_id, user_id, position, payout_amount)
      const baseIndex = rosterParams.length + 1;
      rosterValues.push(`($${baseIndex}, $${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`);
      rosterParams.push(cycle.cycle_id, member.user_id, index + 1, payoutAmount);
    });

    await client.query(
      `INSERT INTO rosca_roster (cycle_id, user_id, position, payout_amount)
             VALUES ${rosterValues.join(',')}`,
      rosterParams,
    );

    await client.query('COMMIT');

    // Clear relevant caches
    cache.del(`rosca_cycles_${chama_id}`);

    res.status(201).json({
      success: true,
      data: { ...cycle, member_count: members.rows.length },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.logError(error, {
      context: 'rosca_createCycle',
      chamaId: chama_id,
      userId,
    });
    res.status(500).json({
      success: false,
      message: 'Error creating ROSCA cycle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    client.release();
  }
};

/**
 * @desc    Get ROSCA cycles for a chama
 * @route   GET /api/rosca/chama/:chamaId/cycles
 * @access  Private (Chama members)
 */
const getChamaCycles = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const cacheKey = `rosca_cycles_${chamaId}`;

    // Check cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData, cached: true });
    }

    const result = await pool.query(
      `SELECT rc.*, 
                    (SELECT COUNT(*) FROM rosca_roster WHERE cycle_id = rc.cycle_id) as total_members,
                    (SELECT COUNT(*) FROM rosca_roster WHERE cycle_id = rc.cycle_id AND status = 'PAID') as completed_payouts
             FROM rosca_cycles rc
             WHERE rc.chama_id = $1
             ORDER BY rc.start_date DESC`,
      [chamaId],
    );

    // Cache for 5 minutes
    cache.set(cacheKey, result.rows);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.logError(error, {
      context: 'rosca_getChamaCycles',
      chamaId,
      userId: req.user?.user_id,
    });
    res.status(500).json({
      success: false,
      message: 'Error fetching ROSCA cycles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get ROSCA roster for a cycle
 * @route   GET /api/rosca/cycles/:cycleId/roster
 * @access  Private (Chama members)
 */
const getCycleRoster = async (req, res) => {
  try {
    const { cycleId } = req.params;
    const userId = req.user.user_id;
    const cacheKey = `rosca_roster_${cycleId}`;

    // Enforce that the requesting user is a member of the chama that owns this cycle
    const membershipCheck = await pool.query(
      `SELECT 1
             FROM rosca_cycles rc
             JOIN chama_members cm ON cm.chama_id = rc.chama_id AND cm.user_id = $2 AND cm.is_active = true
             WHERE rc.cycle_id = $1`,
      [cycleId, userId],
    );

    if (membershipCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this ROSCA roster',
      });
    }

    // Check cache
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData, cached: true });
    }

    const result = await pool.query(
      `SELECT rr.*, 
                    u.first_name, u.last_name
             FROM rosca_roster rr
             JOIN users u ON rr.user_id = u.user_id
             WHERE rr.cycle_id = $1
             ORDER BY rr.position`,
      [cycleId],
    );

    // Cache for 5 minutes
    cache.set(cacheKey, result.rows);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.logError(error, {
      context: 'rosca_getCycleRoster',
      cycleId: req.params?.cycleId,
      userId: req.user?.user_id,
    });
    res.status(500).json({
      success: false,
      message: 'Error fetching ROSCA roster',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Process a ROSCA payout
 * @route   POST /api/rosca/cycles/:cycleId/payout
 * @access  Private (Treasurer)
 */
const processPayout = async (req, res) => {
  const client = await pool.connect();
  const { cycleId } = req.params;
  const { position, payment_proof } = req.body;
  const userId = req.user.user_id;

  const payoutPosition = parseInt(position, 10);
  if (!Number.isInteger(payoutPosition) || payoutPosition <= 0) {
    await client.release();
    return res.status(400).json({ success: false, message: 'Invalid payout position' });
  }

  if (payment_proof && (typeof payment_proof !== 'string' || payment_proof.length > 512)) {
    await client.release();
    return res.status(400).json({ success: false, message: 'Invalid payment proof format' });
  }

  try {
    await client.query('BEGIN');

    // Verify cycle exists and is active
    const cycleResult = await client.query(
      `SELECT * FROM rosca_cycles 
             WHERE cycle_id = $1 AND status = 'ACTIVE'`,
      [cycleId],
    );

    if (cycleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Active cycle not found',
      });
    }

    const cycle = cycleResult.rows[0];

    // Verify user is treasurer
    const isTreasurer = await client.query(
      `SELECT 1 FROM chama_members 
             WHERE chama_id = $1 AND user_id = $2 AND role = 'TREASURER'`,
      [cycle.chama_id, userId],
    );

    if (isTreasurer.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Only treasurers can process payouts',
      });
    }

    // Get the roster entry to pay out
    const rosterResult = await client.query(
      `SELECT * FROM rosca_roster 
             WHERE cycle_id = $1 AND position = $2 AND status = 'PENDING'
             FOR UPDATE`,
      [cycleId, payoutPosition],
    );

    if (rosterResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Invalid position or already paid',
      });
    }

    const rosterEntry = rosterResult.rows[0];

    // Verify all members (except the recipient) have paid enough times for this position
    // E.g. If Payout Position is 3, everyone else should have made at least 3 contributions to this cycle
    const unpaidCount = await client.query(
      `SELECT COUNT(*) FROM rosca_roster rr
             WHERE rr.cycle_id = $1 
             AND rr.user_id != $2 -- Exclude the person being paid
             AND (
                 SELECT COUNT(*) FROM contributions c 
                 WHERE c.cycle_id = rr.cycle_id 
                 AND c.user_id = rr.user_id
                 AND c.amount >= $3
             ) < $4`,
      [cycleId, rosterEntry.user_id, cycle.contribution_amount, payoutPosition],
    );

    if (parseInt(unpaidCount.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Not all members have contributed for round ${payoutPosition}. Waiting for contributions.`,
      });
    }

    // Update roster entry
    await client.query(
      `UPDATE rosca_roster 
             SET status = 'PAID', 
                 payout_date = NOW(),
                 payment_proof = $1,
                 updated_at = NOW()
             WHERE roster_id = $2`,
      [payment_proof, rosterEntry.roster_id],
    );

    // Record the payout in chama transactions
    await client.query(
      `INSERT INTO transactions 
             (chama_id, user_id, amount, transaction_type, description, reference_id)
             VALUES ($1, $2, $3, 'ROSCA_PAYOUT', 
                    'ROSCA payout for ' || (SELECT cycle_name FROM rosca_cycles WHERE cycle_id = $4),
                    'ROSCA-' || $4 || '-' || $2)`,
      [cycle.chama_id, rosterEntry.user_id, rosterEntry.payout_amount, cycleId],
    );

    // Check if cycle is complete
    const remainingPayouts = await client.query(
      `SELECT COUNT(*) FROM rosca_roster 
             WHERE cycle_id = $1 AND status = 'PENDING'`,
      [cycleId],
    );

    if (parseInt(remainingPayouts.rows[0].count) === 0) {
      // Mark cycle as completed
      await client.query(
        `UPDATE rosca_cycles 
                 SET status = 'COMPLETED', end_date = NOW() 
                 WHERE cycle_id = $1`,
        [cycleId],
      );
    }

    await client.query('COMMIT');

    // Clear caches
    cache.del(`rosca_roster_${cycleId}`);
    cache.del(`rosca_cycles_${cycle.chama_id}`);

    // Notify members via WebSocket
    const io = getIo();
    io.to(`chama_${cycle.chama_id}`).emit('rosca_payout_processed', {
      cycle_id: cycleId,
      user_id: rosterEntry.user_id,
      amount: rosterEntry.payout_amount,
      position,
    });

    res.json({
      success: true,
      message: 'Payout processed successfully',
      data: {
        user_id: rosterEntry.user_id,
        amount: rosterEntry.payout_amount,
        position: payoutPosition,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.logError(error, {
      context: 'rosca_processPayout',
      cycleId,
      userId,
    });
    res.status(500).json({
      success: false,
      message: 'Error processing payout',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    client.release();
  }
};

/**
 * @desc    Request a roster position swap
 * @route   POST /api/rosca/cycles/:cycleId/swap-request
 * @access  Private (Chama members)
 */
const requestPositionSwap = async (req, res) => {
  const client = await pool.connect();
  const { cycleId } = req.params;
  const { target_position, reason } = req.body;
  const userId = req.user.user_id;

  const targetPositionInt = parseInt(target_position, 10);
  if (!Number.isInteger(targetPositionInt) || targetPositionInt <= 0) {
    await client.release();
    return res.status(400).json({ success: false, message: 'Invalid target position' });
  }

  try {
    await client.query('BEGIN');

    // Verify user is part of this cycle
    const userRoster = await client.query(
      `SELECT * FROM rosca_roster 
             WHERE cycle_id = $1 AND user_id = $2`,
      [cycleId, userId],
    );

    if (userRoster.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'You are not part of this ROSCA cycle',
      });
    }

    const userPosition = userRoster.rows[0].position;

    // Verify target position exists and is not the same as current position
    if (target_position === userPosition) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot swap with the same position',
      });
    }

    const targetRoster = await client.query(
      `SELECT * FROM rosca_roster 
             WHERE cycle_id = $1 AND position = $2`,
      [cycleId, targetPositionInt],
    );

    if (targetRoster.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Target position not found',
      });
    }

    const targetUser = targetRoster.rows[0];

    // Check if either position has already been paid
    if (userRoster.rows[0].status === 'PAID' || targetRoster.rows[0].status === 'PAID') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cannot swap positions that have already been paid',
      });
    }

    // Check if there's already a pending swap request
    const existingRequest = await client.query(
      `SELECT * FROM rosca_swap_requests 
             WHERE cycle_id = $1 
             AND ((requester_id = $2 AND target_position = $3)
                  OR (requester_id = $4 AND target_position = $5))
             AND status = 'PENDING'`,
      [cycleId, userId, targetPositionInt, targetUser.user_id, userPosition],
    );

    if (existingRequest.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'A swap request already exists between these positions',
      });
    }

    // Create swap request
    await client.query(
      `INSERT INTO rosca_swap_requests 
             (cycle_id, requester_id, target_position, status, reason)
             VALUES ($1, $2, $3, 'PENDING', $4)`,
      [cycleId, userId, targetPositionInt, reason],
    );

    await client.query('COMMIT');

    // Notify target user via WebSocket
    const io = getIo();
    io.to(`user_${targetUser.user_id}`).emit('rosca_swap_requested', {
      cycle_id: cycleId,
      requester_id: userId,
      target_position,
      reason,
    });

    res.status(201).json({
      success: true,
      message: 'Swap request sent successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.logError(error, {
      context: 'rosca_requestPositionSwap',
      cycleId,
      userId,
    });
    res.status(500).json({
      success: false,
      message: 'Error creating swap request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    client.release();
  }
};

/**
 * @desc    Respond to a swap request
 * @route   PUT /api/rosca/swap-requests/:requestId/respond
 * @access  Private (Chama members)
 */
const respondToSwapRequest = async (req, res) => {
  const client = await pool.connect();
  const { requestId } = req.params;
  const { action } = req.body; // expected: 'APPROVED' or 'REJECTED'
  const userId = req.user.user_id;

  if (!['APPROVED', 'REJECTED'].includes(action)) {
    await client.release();
    return res.status(400).json({ success: false, message: 'Invalid swap action' });
  }

  try {
    await client.query('BEGIN');

    // Get the swap request
    const requestResult = await client.query(
      `SELECT sr.*, rr1.position as requester_position, rr1.user_id as requester_id,
                    rr2.position as target_position, rr2.user_id as target_user_id
             FROM rosca_swap_requests sr
             JOIN rosca_roster rr1 ON sr.cycle_id = rr1.cycle_id AND sr.requester_id = rr1.user_id
             JOIN rosca_roster rr2 ON sr.cycle_id = rr2.cycle_id AND sr.target_position = rr2.position
             WHERE sr.request_id = $1`,
      [requestId],
    );

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Swap request not found',
      });
    }

    const request = requestResult.rows[0];

    // Verify the responding user is the target of the swap
    if (request.target_user_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Not authorized to respond to this request',
      });
    }

    // Update request status
    await client.query(
      `UPDATE rosca_swap_requests 
             SET status = $1, updated_at = NOW()
             WHERE request_id = $2`,
      [action, requestId],
    );

    if (action === 'APPROVED') {
      // Swap the positions in the roster
      await client.query(
        `UPDATE rosca_roster 
                 SET position = CASE 
                     WHEN user_id = $1 THEN $2
                     WHEN user_id = $3 THEN $4
                     ELSE position
                 END,
                 updated_at = NOW()
                 WHERE (user_id = $1 OR user_id = $3) AND cycle_id = $5`,
        [
          request.requester_id, request.target_position,
          request.target_user_id, request.requester_position,
          request.cycle_id,
        ],
      );

      // Clear relevant caches
      cache.del(`rosca_roster_${request.cycle_id}`);

      // Notify both users via WebSocket
      const io = getIo();
      io.to(`user_${request.requester_id}`).emit('rosca_swap_completed', {
        request_id: requestId,
        status: 'APPROVED',
        new_position: request.target_position,
      });

      io.to(`user_${request.target_user_id}`).emit('rosca_swap_completed', {
        request_id: requestId,
        status: 'APPROVED',
        new_position: request.requester_position,
      });
    } else {
      // Notify requester of rejection
      const io = getIo();
      io.to(`user_${request.requester_id}`).emit('rosca_swap_completed', {
        request_id: requestId,
        status: 'REJECTED',
      });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Swap request ${action.toLowerCase()}`,
      data: { status: action },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.logError(error, {
      context: 'rosca_respondToSwapRequest',
      requestId,
      userId,
    });
    res.status(500).json({
      success: false,
      message: 'Error processing swap response',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    client.release();
  }
};

/**
 * @desc    Get user's swap requests
 * @route   GET /api/rosca/swap-requests
 * @access  Private
 */
const getSwapRequests = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Get requests where user is the target
    const incomingRequests = await pool.query(
      `SELECT sr.*, 
                    u.first_name as requester_first_name,
                    u.last_name as requester_last_name,
                    rc.cycle_name,
                    rc.chama_id,
                    c.chama_name
             FROM rosca_swap_requests sr
             JOIN rosca_roster rr ON sr.cycle_id = rr.cycle_id AND sr.target_position = rr.position
             JOIN users u ON sr.requester_id = u.user_id
             JOIN rosca_cycles rc ON sr.cycle_id = rc.cycle_id
             JOIN chamas c ON rc.chama_id = c.chama_id
             WHERE rr.user_id = $1 AND sr.status = 'PENDING'`,
      [userId],
    );

    // Get requests made by the user
    const outgoingRequests = await pool.query(
      `SELECT sr.*, 
                    u.first_name as target_first_name,
                    u.last_name as target_last_name,
                    rc.cycle_name,
                    rc.chama_id,
                    c.chama_name
             FROM rosca_swap_requests sr
             JOIN rosca_roster rr ON sr.cycle_id = rr.cycle_id AND sr.requester_id = $1
             JOIN rosca_roster rr2 ON sr.cycle_id = rr2.cycle_id AND sr.target_position = rr2.position
             JOIN users u ON rr2.user_id = u.user_id
             JOIN rosca_cycles rc ON sr.cycle_id = rc.cycle_id
             JOIN chamas c ON rc.chama_id = c.chama_id
             WHERE sr.requester_id = $1`,
      [userId],
    );

    res.json({
      success: true,
      data: {
        incoming: incomingRequests.rows,
        outgoing: outgoingRequests.rows,
      },
    });
  } catch (error) {
    logger.logError(error, {
      context: 'rosca_getSwapRequests',
      userId: req.user?.user_id,
    });
    res.status(500).json({
      success: false,
      message: 'Error fetching swap requests',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};


/**
 * @desc    Delete a ROSCA cycle
 * @route   DELETE /api/rosca/cycles/:cycleId
 * @access  Private (Admin/Officials)
 */
const deleteCycle = async (req, res) => {
  const client = await pool.connect();
  const { cycleId } = req.params;
  const userId = req.user.user_id;

  try {
    await client.query('BEGIN');

    // Verify cycle exists
    const cycleResult = await client.query(
      'SELECT * FROM rosca_cycles WHERE cycle_id = $1',
      [cycleId],
    );

    if (cycleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Cycle not found' });
    }

    const cycle = cycleResult.rows[0];

    // Check authorization (Officials of the chama)
    const authCheck = await client.query(
      `SELECT 1 FROM chama_members 
             WHERE chama_id = $1 AND user_id = $2 AND role IN ('CHAIRPERSON', 'TREASURER', 'SECRETARY')`,
      [cycle.chama_id, userId],
    );

    if (authCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Not authorized to delete this cycle' });
    }

    // Delete related data (CASCADE usually handles this, but explicit for safety)
    await client.query('DELETE FROM rosca_swap_requests WHERE cycle_id = $1', [cycleId]);
    await client.query('DELETE FROM rosca_roster WHERE cycle_id = $1', [cycleId]);
    await client.query('DELETE FROM rosca_cycles WHERE cycle_id = $1', [cycleId]);

    await client.query('COMMIT');

    // Clear caches
    cache.del(`rosca_cycles_${cycle.chama_id}`);
    cache.del(`rosca_roster_${cycleId}`);

    res.json({ success: true, message: 'Cycle deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.logError(error, {
      context: 'rosca_deleteCycle',
      cycleId,
      userId,
    });
    res.status(500).json({ success: false, message: 'Error deleting cycle' });
  } finally {
    client.release();
  }
};

module.exports = {
  createCycle,
  getChamaCycles,
  getCycleRoster,
  processPayout,
  requestPositionSwap,
  respondToSwapRequest,
  getSwapRequests,
  deleteCycle,
};
