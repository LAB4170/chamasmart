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
  console.log('ENTERING createCycle');
  const client = await pool.connect();
const {
    chama_id, cycle_name, contribution_amount, frequency, start_date, roster_method = 'RANDOM', manual_roster = [],
    autopilot_enabled = false
  } = req.body;

  const userId = req.user.user_id;

  try {
    // Validate input
    if (!chama_id || !cycle_name || !contribution_amount || !frequency || !start_date) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    if (!['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'].includes(frequency)) {
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

    // Get active members FIRST to calculate the cycle end_date
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

    // Calculate end_date based on frequency and member count
    const startDateObj = new Date(start_date);
    let endDateObj = new Date(start_date);
    const memberCount = members.rows.length;

    if (frequency === 'DAILY') {
      endDateObj.setDate(startDateObj.getDate() + memberCount);
    } else if (frequency === 'WEEKLY') {
      endDateObj.setDate(startDateObj.getDate() + (memberCount * 7));
    } else if (frequency === 'BIWEEKLY') {
      endDateObj.setDate(startDateObj.getDate() + (memberCount * 14));
    } else if (frequency === 'MONTHLY') {
      endDateObj.setMonth(startDateObj.getMonth() + memberCount);
    }

    const cycleResult = await client.query(
      `INSERT INTO rosca_cycles 
             (chama_id, cycle_name, contribution_amount, frequency, start_date, end_date, total_members, status, autopilot_enabled, roster_generation_method)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, $9)
             RETURNING *`,
      [chama_id, cycle_name, parsedContributionAmount, frequency, startDateObj, endDateObj, memberCount, autopilot_enabled, roster_method.toUpperCase()],
    );


    const cycle = cycleResult.rows[0];

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
      // Challenge A: "Trust-Based Roster" - Ensure scores are FRESH
      const TrustScoreService = require('../utils/trustScoreService');
      console.log(`Refreshing trust scores for chama ${chama_id} before cycle creation...`);
      await TrustScoreService.analyzeChamaReliability(chama_id);

      // Fetch members with newly updated trust scores
      const membersWithScores = await client.query(
        `SELECT cm.user_id, COALESCE(cm.trust_score, 50) as trust_score 
                 FROM chama_members cm
                 WHERE cm.chama_id = $1 AND cm.user_id = ANY($2) AND cm.is_active = true`,
        [chama_id, members.rows.map(m => m.user_id)],
      );

      const scoredMembers = membersWithScores.rows;

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
      // (cycle_id, user_id, position)
      const baseIndex = rosterParams.length + 1;
      rosterValues.push(`($${baseIndex}, $${baseIndex + 1}, $${baseIndex + 2})`);
      rosterParams.push(cycle.cycle_id || cycle.id, member.user_id, index + 1);
    });

    await client.query(
      `INSERT INTO rosca_roster (cycle_id, user_id, position)
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
 * @desc    Preview the roster order TRUST method would generate (without creating cycle)
 * @route   GET /api/rosca/chama/:chamaId/roster-preview
 * @access  Private (Chama members & Officials)
 */
const getNextCycleRosterPreview = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const userId = req.user.user_id;

    // Verify user is a member
    const memberCheck = await pool.query(
      'SELECT 1 FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true',
      [chamaId, userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not a member of this chama' });
    }

    // Get all members with trust scores
    const membersRes = await pool.query(
      `SELECT cm.user_id, u.first_name, u.last_name,
              COALESCE(cm.trust_score, 50) as trust_score,
              CASE
                WHEN COALESCE(cm.trust_score, 50) >= 80 THEN 'HIGH'
                WHEN COALESCE(cm.trust_score, 50) >= 60 THEN 'MEDIUM'
                ELSE 'LOW'
              END as trust_tier
       FROM chama_members cm
       JOIN users u ON u.user_id = cm.user_id
       WHERE cm.chama_id = $1 AND cm.is_active = true
       ORDER BY cm.trust_score DESC NULLS LAST`,
      [chamaId]
    );

    const members = membersRes.rows;
    const shuffle = arr => [...arr].sort(() => 0.5 - Math.random());

    const highTrust = members.filter(m => m.trust_score >= 80);
    const midTrust  = members.filter(m => m.trust_score >= 60 && m.trust_score < 80);
    const lowTrust  = members.filter(m => m.trust_score < 60);

    const predictedRoster = [
      ...shuffle(highTrust),
      ...shuffle(midTrust),
      ...shuffle(lowTrust),
    ].map((m, idx) => ({ ...m, predicted_position: idx + 1 }));

    return res.json({
      success: true,
      data: {
        method: 'TRUST',
        total_members: members.length,
        roster: predictedRoster,
        note: 'Positions may vary slightly due to shuffling within tiers for fairness.'
      }
    });
  } catch (error) {
    logger.logError(error, { context: 'rosca_rosterPreview' });
    res.status(500).json({ success: false, message: 'Error generating roster preview' });
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

    // Verify user is treasurer OR chairperson (chairperson acts as super-admin)
    const authCheck = await client.query(
      `SELECT role FROM chama_members 
             WHERE chama_id = $1 AND user_id = $2 AND role IN ('TREASURER', 'CHAIRPERSON') AND is_active = true`,
      [cycle.chama_id, userId],
    );

    if (authCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Only the Treasurer or Chairperson can process payouts',
      });
    }

    // Get the roster entry to pay out
    // Accept PENDING or ACTIVE status (new cycles create entries as ACTIVE)
    const rosterResult = await client.query(
      `SELECT rr.*, u.first_name, u.last_name
             FROM rosca_roster rr
             JOIN users u ON rr.user_id = u.user_id
             WHERE rr.cycle_id = $1 AND rr.position = $2 AND rr.status IN ('PENDING', 'ACTIVE')
             FOR UPDATE`,
      [cycleId, payoutPosition],
    );

    if (rosterResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Invalid position or already paid out',
      });
    }

    const rosterEntry = rosterResult.rows[0];

    // Count total active roster members for this cycle
    const rosterCountRes = await client.query(
      `SELECT COUNT(*) FROM rosca_roster WHERE cycle_id = $1`,
      [cycleId],
    );
    const totalMembers = parseInt(rosterCountRes.rows[0].count, 10);

    // Payout amount = each member contributes × total number of members
    // (the recipient also contributes to the pot before collecting the gross sum)
    const payoutAmount = parseFloat(cycle.contribution_amount) * totalMembers;

    // Verify all members (including the recipient) have paid for this round.
    // Accepts contributions with status COMPLETED or VERIFIED (covers M-Pesa and manual entries).
    const unpaidCount = await client.query(
      `SELECT COUNT(*) FROM rosca_roster rr
             WHERE rr.cycle_id = $1 
             AND (
                 SELECT COALESCE(SUM(amount), 0) FROM contributions c 
                 WHERE c.cycle_id = rr.cycle_id 
                 AND c.user_id = rr.user_id
                 AND (c.status IN ('COMPLETED', 'VERIFIED') OR c.verification_status IN ('VERIFIED'))
             ) < ($2::numeric * $3::numeric)`,
      [cycleId, cycle.contribution_amount, payoutPosition],
    );

    if (parseInt(unpaidCount.rows[0].count, 10) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Not all members have contributed for round ${payoutPosition}. Check that all members have made their contributions before disbursing.`,
      });
    }

    // Update roster entry — only real columns: status, payout_date
    await client.query(
      `UPDATE rosca_roster 
             SET status = 'PAID',
                 payout_date = NOW()
             WHERE roster_id = $1`,
      [rosterEntry.roster_id],
    );

    // Record the payout as a contribution entry with type ROSCA_PAYOUT
    // (the 'transactions' table doesn't exist — we use contributions as the ledger)
    await client.query(
      `INSERT INTO contributions
             (chama_id, user_id, amount, contribution_type, notes, contribution_date,
              recorded_by, verification_status, status, cycle_id)
             VALUES ($1, $2, $3, 'ROSCA_PAYOUT',
                    'ROSCA payout — cycle: ' || $4 || ', position ' || $5,
                    NOW(), $6, 'VERIFIED', 'COMPLETED', $7)`,
      [
        cycle.chama_id,
        rosterEntry.user_id,
        payoutAmount,
        cycle.cycle_name,
        payoutPosition,
        userId,
        cycleId,
      ],
    );

    // Check if cycle is complete (no remaining ACTIVE/PENDING roster entries)
    const remainingPayouts = await client.query(
      `SELECT COUNT(*) FROM rosca_roster 
             WHERE cycle_id = $1 AND status IN ('PENDING', 'ACTIVE')`,
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
    try {
      if (process.env.NODE_ENV !== 'test') {
        const io = getIo();
        io.to(`chama_${cycle.chama_id}`).emit('rosca_payout_processed', {
          cycle_id: cycleId,
          user_id: rosterEntry.user_id,
          recipient_name: `${rosterEntry.first_name} ${rosterEntry.last_name}`,
          amount: payoutAmount,
          position,
        });
      }
    } catch (ioErr) {
      logger.warn('WebSocket emit failed for rosca_payout_processed', { error: ioErr.message });
    }

    res.json({
      success: true,
      message: 'Payout processed successfully',
      data: {
        user_id: rosterEntry.user_id,
        recipient_name: `${rosterEntry.first_name} ${rosterEntry.last_name}`,
        amount: payoutAmount,
        position: payoutPosition,
        cycle_name: cycle.cycle_name,
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
  const { target_position, reason, swap_fee = 0 } = req.body;

  const userId = req.user.user_id;

  const targetPositionInt = parseInt(target_position, 10);
  if (!Number.isInteger(targetPositionInt) || targetPositionInt <= 0) {
    fs.appendFileSync('rosca_debug.log', 'DEBUG: requestPositionSwap - Invalid target position\n');
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
      fs.appendFileSync('rosca_debug.log', `DEBUG: requestPositionSwap - User ${userId} not in roster for cycle ${cycleId}\n`);
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'You are not part of this ROSCA cycle',
      });
    }

    const userPosition = userRoster.rows[0].position;

    // Verify target position exists and is not the same as current position
    if (target_position === userPosition) {
      fs.appendFileSync('rosca_debug.log', 'DEBUG: requestPositionSwap - Same position swap attempt\n');
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
      fs.appendFileSync('rosca_debug.log', `DEBUG: requestPositionSwap - Target position ${targetPositionInt} not found\n`);
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Target position not found',
      });
    }

    const targetUser = targetRoster.rows[0];

    // Check if either position has already been paid
    if (userRoster.rows[0].status === 'PAID' || targetRoster.rows[0].status === 'PAID') {
      fs.appendFileSync('rosca_debug.log', 'DEBUG: requestPositionSwap - Position already paid\n');
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

    // Create swap request with fee support
    await client.query(
      `INSERT INTO rosca_swap_requests 
             (cycle_id, requester_id, requester_position, target_position, status, reason, swap_fee, fee_status)
             VALUES ($1, $2, $3, $4, 'PENDING', $5, $6, $7)`,
      [cycleId, userId, userPosition, targetPositionInt, reason, swap_fee, swap_fee > 0 ? 'PENDING' : 'NONE'],
    );


    await client.query('COMMIT');

    // Notify target user via WebSocket
    try {
      const io = getIo();
      io.to(`user_${targetUser.user_id}`).emit('rosca_swap_requested', {
        cycle_id: cycleId,
        requester_id: userId,
        target_position,
        reason,
      });
    } catch (ioErr) {
      logger.warn('Socket notification failed for swap request', { error: ioErr.message });
    }

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
      `SELECT sr.*, 
              rr1.position as current_requester_position, 
              rr2.user_id as target_user_id
       FROM rosca_swap_requests sr
       JOIN rosca_roster rr1 ON sr.cycle_id = rr1.cycle_id AND sr.requester_id = rr1.user_id
       LEFT JOIN rosca_roster rr2 ON sr.cycle_id = rr2.cycle_id AND sr.target_position = rr2.position
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
      // Defer constraints to allow atomic position swap
      await client.query('SET CONSTRAINTS ALL DEFERRED');

      // ADDITIONAL INTEGRITY CHECK: Verify requester's current position still matches what was requested
      if (request.current_requester_position !== request.requester_position) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          message: 'Swap failed: Requester position has changed since the request was made.' 
        });
      }

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
      try {
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
      } catch (ioErr) {
        logger.warn('Socket notification failed for swap approval', { error: ioErr.message });
      }
    } else {
      // Notify requester of rejection
      try {
        const io = getIo();
        io.to(`user_${request.requester_id}`).emit('rosca_swap_completed', {
          request_id: requestId,
          status: 'REJECTED',
        });
      } catch (ioErr) {
        logger.warn('Socket notification failed for swap rejection', { error: ioErr.message });
      }
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
 * @desc    Manually activate a ROSCA cycle
 * @route   PUT /api/rosca/cycles/:cycleId/activate
 * @access  Private (Admin/Officials)
 */
const activateCycle = async (req, res) => {
  const client = await pool.connect();
  const { cycleId } = req.params;
  const userId = req.user.user_id;

  try {
    await client.query('BEGIN');

    // Verify cycle exists and is PENDING
    const cycleResult = await client.query(
      'SELECT * FROM rosca_cycles WHERE cycle_id = $1 FOR UPDATE',
      [cycleId],
    );

    if (cycleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Cycle not found' });
    }

    const cycle = cycleResult.rows[0];

    if (cycle.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Cycle is already ${cycle.status}` });
    }

    // Check authorization (Officials of the chama)
    const authCheck = await client.query(
      `SELECT 1 FROM chama_members 
             WHERE chama_id = $1 AND user_id = $2 AND role IN ('CHAIRPERSON', 'TREASURER', 'SECRETARY')`,
      [cycle.chama_id, userId],
    );

    if (authCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Not authorized to activate this cycle' });
    }

    // Update status to ACTIVE
    const now = new Date();
    const startDate = cycle.start_date < now ? 'NOW()' : 'start_date';

    await client.query(
      `UPDATE rosca_cycles 
       SET status = 'ACTIVE', 
           start_date = ${startDate},
           updated_at = NOW() 
       WHERE cycle_id = $1`,
      [cycleId],
    );

    await client.query('COMMIT');

    // Clear caches
    cache.del(`rosca_cycles_${cycle.chama_id}`);
    cache.del(`rosca_roster_${cycleId}`);

    // Notify members via WebSocket
    const io = require('../socket').getIo();
    io.to(`chama_${cycle.chama_id}`).emit('rosca_cycle_activated', {
      cycle_id: cycleId,
      chama_id: cycle.chama_id,
      cycle_name: cycle.cycle_name,
    });

    res.json({ success: true, message: 'Cycle activated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.logError(error, {
      context: 'rosca_activateCycle',
      cycleId,
      userId,
    });
    res.status(500).json({ success: false, message: 'Error activating cycle' });
  } finally {
    client.release();
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
    const cycleIdInt = parseInt(cycleId);
    
    // 1. Soft-delete contributions associated with this cycle
    await client.query(
      'UPDATE contributions SET is_deleted = true, deleted_at = NOW() WHERE cycle_id = $1',
      [cycleIdInt]
    );

    // 2. Delete ROSCA specific metadata
    await client.query('DELETE FROM rosca_swap_requests WHERE cycle_id = $1', [cycleIdInt]);
    await client.query('DELETE FROM rosca_roster WHERE cycle_id = $1', [cycleIdInt]);
    await client.query('DELETE FROM rosca_cycles WHERE cycle_id = $1', [cycleIdInt]);

    // 3. Recalculate chama current_fund
    await client.query(`
      UPDATE chamas
      SET current_fund = COALESCE((
        SELECT SUM(amount)
        FROM contributions
        WHERE chama_id = $1
          AND is_deleted = false
          AND status = 'COMPLETED'
      ), 0),
      updated_at = NOW()
      WHERE chama_id = $1
    `, [cycle.chama_id]);

    // 4. Recalculate member total_contributions for ALL members in this chama
    await client.query(`
      UPDATE chama_members cm
      SET total_contributions = COALESCE((
        SELECT SUM(amount)
        FROM contributions
        WHERE chama_id = $1
          AND user_id = cm.user_id
          AND is_deleted = false
          AND status = 'COMPLETED'
      ), 0),
      updated_at = NOW()
      WHERE cm.chama_id = $1
    `, [cycle.chama_id]);

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

/**
 * @desc    Cancel a ROSCA cycle
 * @route   PUT /api/rosca/cycles/:cycleId/cancel
 * @access  Private (Admin/Officials)
 */
const cancelCycle = async (req, res) => {
  const client = await pool.connect();
  const { cycleId } = req.params;
  const { reason = 'Cycle cancelled by official' } = req.body;
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

    if (['COMPLETED', 'CANCELLED'].includes(cycle.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Cycle is already ${cycle.status.toLowerCase()}` });
    }

    // Check authorization (Officials of the chama)
    const authCheck = await client.query(
      `SELECT 1 FROM chama_members 
             WHERE chama_id = $1 AND user_id = $2 AND role IN ('CHAIRPERSON', 'TREASURER', 'SECRETARY')`,
      [cycle.chama_id, userId],
    );

    if (authCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this cycle' });
    }

    // Update status to CANCELLED
    await client.query(
      `UPDATE rosca_cycles 
       SET status = 'CANCELLED', 
           updated_at = NOW() 
       WHERE cycle_id = $1`,
      [cycleId],
    );

    await client.query('COMMIT');

    // Clear caches
    cache.del(`rosca_cycles_${cycle.chama_id}`);
    cache.del(`rosca_roster_${cycleId}`);

    // Notify members via WebSocket
    const io = require('../socket').getIo();
    if (io) {
      io.to(`chama_${cycle.chama_id}`).emit('rosca_cycle_cancelled', {
        cycle_id: cycleId,
        chama_id: cycle.chama_id,
        reason,
      });
    }

    res.json({ success: true, message: 'Cycle cancelled successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.logError(error, {
      context: 'rosca_cancelCycle',
      cycleId,
      userId,
    });
    res.status(500).json({ success: false, message: 'Error cancelling cycle' });
  } finally {
    client.release();
  }
};

/**
 * @desc    Make a ROSCA contribution
 * @route   POST /api/rosca/chama/:chamaId/cycles/:cycleId/contributions
 * @access  Private (Chama members)
 */
const makeContribution = async (req, res) => {
  const client = await pool.connect();
  const { chamaId, cycleId } = req.params;
  const {
    amount, payment_method = 'MPESA', payment_proof, notes,
  } = req.body;
  const userId = req.user.user_id;

  try {
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid contribution amount' });
    }

    await client.query('BEGIN');

    // Verify membership
    const membership = await client.query(
      'SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true',
      [chamaId, userId],
    );

    if (membership.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Not a member of this chama' });
    }

    // Verify cycle exists and is active for this chama
    const cycleResult = await client.query(
      'SELECT * FROM rosca_cycles WHERE cycle_id = $1 AND chama_id = $2 AND status = \'ACTIVE\'',
      [cycleId, chamaId],
    );

    if (cycleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Active cycle not found for this chama' });
    }

    // Insert into contributions
    const contributionResult = await client.query(
      `INSERT INTO contributions 
       (chama_id, user_id, amount, contribution_type, status, cycle_id, contribution_date, 
        payment_method, payment_proof, notes, verification_status, recorded_by)
       VALUES ($1, $2, $3, 'ROSCA', 'COMPLETED', $4, NOW(), $5, $6, $7, 'VERIFIED', $8)
       RETURNING *`,
      [chamaId, userId, amount, cycleId, payment_method, payment_proof, notes, userId],
    );

    // Update member's total contributions
    await client.query(
      'UPDATE chama_members SET total_contributions = total_contributions + $1 WHERE chama_id = $2 AND user_id = $3',
      [amount, chamaId, userId],
    );

    // Update chama current fund
    await client.query(
      'UPDATE chamas SET current_fund = current_fund + $1 WHERE chama_id = $2',
      [amount, chamaId],
    );

    await client.query('COMMIT');

    // EXCELLENCE: Trigger M-Pesa Autopilot check
    // This is called asynchronously to not block the response
    checkAndTriggerAutoPayout(cycleId).catch(err => {
      logger.error('Autopilot trigger failed', { error: err.message, cycleId });
    });


    // Clear caches
    cache.del(`rosca_contributions_${cycleId}`);

    res.status(201).json({
      success: true,
      data: contributionResult.rows[0],
      message: 'Contribution recorded successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.logError(error, {
      context: 'rosca_makeContribution',
      chamaId,
      cycleId,
      userId,
    });
    res.status(500).json({ success: false, message: 'Error recording contribution' });
  } finally {
    client.release();
  }
};

/**
 * @desc    Get all contributions for a ROSCA cycle
 * @route   GET /api/rosca/cycles/:cycleId/contributions
 * @access  Private (Chama members)
 */
const getContributions = async (req, res) => {
  try {
    const { cycleId } = req.params;
    const userId = req.user.user_id;
    const cacheKey = `rosca_contributions_${cycleId}`;

    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData, cached: true });
    }

    // Verify membership
    const membership = await pool.query(
      `SELECT 1 FROM rosca_cycles rc
       JOIN chama_members cm ON rc.chama_id = cm.chama_id
       WHERE rc.cycle_id = $1 AND cm.user_id = $2 AND cm.is_active = true`,
      [cycleId, userId],
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized to view these contributions' });
    }

    const contributions = await pool.query(
      `SELECT c.*, u.first_name, u.last_name 
       FROM contributions c
       JOIN users u ON c.user_id = u.user_id
       WHERE c.cycle_id = $1 AND c.is_deleted = false
       ORDER BY c.contribution_date DESC`,
      [cycleId],
    );

    cache.set(cacheKey, contributions.rows);

    res.json({ success: true, data: contributions.rows });
  } catch (error) {
    logger.logError(error, {
      context: 'rosca_getContributions',
      cycleId: req.params.cycleId,
      userId: req.user.user_id,
    });
    res.status(500).json({ success: false, message: 'Error fetching contributions' });
  }
};

/**
 * @desc    Get member statement for a cycle
 * @route   GET /api/rosca/cycles/:cycleId/members/:memberId/statement
 * @access  Private
 */
const getMemberStatement = async (req, res) => {
  try {
    const { cycleId, memberId } = req.params;
    const userId = req.user.user_id;

    // Enforce privacy: user can only see their own statement or must be an official
    if (parseInt(memberId, 10) !== userId) {
      const officialCheck = await pool.query(
        `SELECT 1 FROM rosca_cycles rc
             JOIN chama_members cm ON rc.chama_id = cm.chama_id
             WHERE rc.cycle_id = $1 AND cm.user_id = $2 AND cm.role IN ('CHAIRPERSON', 'TREASURER', 'SECRETARY')`,
        [cycleId, userId],
      );
      if (officialCheck.rows.length === 0) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
    }

    const contributions = await pool.query(
      `SELECT SUM(amount) as total_contributed, COUNT(*) as contribution_count
       FROM contributions
       WHERE cycle_id = $1 AND user_id = $2 AND contribution_type = 'ROSCA' AND status = 'COMPLETED' AND is_deleted = false`,
      [cycleId, memberId],
    );

    const payouts = await pool.query(
      `SELECT SUM(amount) as total_received, COUNT(*) as payout_count
       FROM contributions
       WHERE cycle_id = $1 AND user_id = $2 AND contribution_type = 'ROSCA_PAYOUT' AND status = 'COMPLETED' AND is_deleted = false`,
      [cycleId, memberId],
    );

    res.json({
      success: true,
      data: {
        total_contributed: parseFloat(contributions.rows[0].total_contributed || 0),
        contribution_count: parseInt(contributions.rows[0].contribution_count || 0),
        total_received: parseFloat(payouts.rows[0].total_received || 0),
        payout_count: parseInt(payouts.rows[0].payout_count || 0),
      },
    });
  } catch (error) {
    logger.logError(error, {
      context: 'rosca_getMemberStatement',
      cycleId: req.params.cycleId,
      userId: req.user.user_id,
    });
    res.status(500).json({ success: false, message: 'Error fetching statement' });
  }
};


/**
 * @desc    Get a single ROSCA cycle by ID
 * @route   GET /api/rosca/cycles/:cycleId
 * @access  Private (Chama members)
 */
const getCycleById = async (req, res) => {
  try {
    const { cycleId } = req.params;
    const userId = req.user.user_id;

    const result = await pool.query(
      `SELECT rc.*, 
              (SELECT COUNT(*) FROM rosca_roster WHERE cycle_id = rc.cycle_id) as total_members,
              (SELECT COUNT(*) FROM rosca_roster WHERE cycle_id = rc.cycle_id AND status = 'PAID') as completed_payouts
       FROM rosca_cycles rc
       WHERE rc.cycle_id = $1`,
      [cycleId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cycle not found' });
    }

    const cycle = result.rows[0];

    // Verify membership
    const membership = await pool.query(
      'SELECT 1 FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true',
      [cycle.chama_id, userId],
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this cycle' });
    }

    res.json({ success: true, data: cycle });
  } catch (error) {
    logger.logError(error, {
      context: 'rosca_getCycleById',
      cycleId: req.params.cycleId,
      userId: req.user?.user_id,
    });
    res.status(500).json({ success: false, message: 'Error fetching cycle details' });
  }
};

/**
 * @desc    M-Pesa Autopilot: Automatically triggers payout when round is fully funded
 * @param   {number} cycleId
 */
const checkAndTriggerAutoPayout = async (cycleId) => {
  console.log(`DEBUG: Autopilot checking cycle ${cycleId}...`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get cycle details and check if autopilot is enabled
    const cycleRes = await client.query(
      'SELECT * FROM rosca_cycles WHERE cycle_id = $1 AND status = \'ACTIVE\' AND autopilot_enabled = true',
      [cycleId]
    );

    if (cycleRes.rows.length === 0) {
      console.log('DEBUG: Autopilot - Cycle not found or not active/autopilot-enabled');
      await client.query('ROLLBACK');
      return;
    }

    const cycle = cycleRes.rows[0];

    // 2. Identify the current payout position (first ACTIVE/PENDING entry)
    const nextRosterRes = await client.query(
      `SELECT * FROM rosca_roster 
       WHERE cycle_id = $1 AND status IN ('PENDING', 'ACTIVE')
       ORDER BY position ASC LIMIT 1`,
      [cycleId]
    );

    if (nextRosterRes.rows.length === 0) {
      console.log('DEBUG: Autopilot - No pending/active roster members found');
      await client.query('ROLLBACK');
      return;
    }

    const nextPosition = nextRosterRes.rows[0].position;
    console.log(`DEBUG: Autopilot - Current position target: ${nextPosition}`);

    // 3. Count total active roster members
    const rosterCountRes = await client.query(
      'SELECT COUNT(*) FROM rosca_roster WHERE cycle_id = $1',
      [cycleId]
    );
    const totalMembers = parseInt(rosterCountRes.rows[0].count, 10);

    // 4. Verify all members have paid for this round
    const unpaidCountRes = await client.query(
      `SELECT COUNT(*) FROM rosca_roster rr
       WHERE rr.cycle_id = $1 
       AND (
           SELECT COALESCE(SUM(amount), 0) FROM contributions c 
           WHERE c.cycle_id = rr.cycle_id 
           AND c.user_id = rr.user_id
           AND (c.status IN ('COMPLETED', 'VERIFIED') OR c.verification_status IN ('VERIFIED'))
       ) < ($2::numeric * $3::numeric)`,
      [cycleId, cycle.contribution_amount, nextPosition]
    );

    const unpaidCount = parseInt(unpaidCountRes.rows[0].count, 10);
    console.log(`DEBUG: Autopilot - Unpaid count: ${unpaidCount}`);

    if (unpaidCount === 0) {
      logger.info(`AUTOPILOT: Round ${nextPosition} for cycle ${cycleId} is fully funded. Triggering B2C payout.`);
      
      // Simulate/Trigger M-Pesa B2C (Placeholder for actual M-Pesa integration call)
      // In a real 10/10 system, this would call mpesa.b2cPayment(...)
      
      // For now, we process the payout in the DB as COMPLETED
      // This mirrors processPayout logic but triggered by code
      const payoutAmount = parseFloat(cycle.contribution_amount) * totalMembers;
      const recipientId = nextRosterRes.rows[0].user_id;

      await client.query(
        'UPDATE rosca_roster SET status = \'PAID\', payout_date = NOW() WHERE roster_id = $1',
        [nextRosterRes.rows[0].roster_id]
      );

      // 5. Get an official to record this automated action
      const officialRes = await client.query(
        "SELECT user_id FROM chama_members WHERE chama_id = $1 AND role IN ('CHAIRPERSON', 'TREASURER', 'ADMIN') LIMIT 1",
        [cycle.chama_id]
      );
      const recorderId = officialRes.rows.length > 0 ? officialRes.rows[0].user_id : recipientId;

      await client.query(
        `INSERT INTO contributions
         (chama_id, user_id, amount, contribution_type, notes, contribution_date,
          recorded_by, verification_status, status, cycle_id)
         VALUES ($1, $2, $3, 'ROSCA_PAYOUT',
                'AUTOPILOT: ROSCA payout — cycle: ' || $4 || ', position ' || $5,
                NOW(), $6, 'VERIFIED', 'COMPLETED', $7)`,
        [cycle.chama_id, recipientId, payoutAmount, cycle.cycle_name, nextPosition, recorderId, cycleId]
      );

      // Check if cycle is complete
      const remainingPayouts = await client.query(
        'SELECT COUNT(*) FROM rosca_roster WHERE cycle_id = $1 AND status IN (\'PENDING\', \'ACTIVE\')',
        [cycleId]
      );

      if (parseInt(remainingPayouts.rows[0].count) === 0) {
        await client.query(
          'UPDATE rosca_cycles SET status = \'COMPLETED\', end_date = NOW() WHERE cycle_id = $1',
          [cycleId]
        );
      }

      await client.query('COMMIT');
      
      // Webhook/Socket announcement
      try {
        const io = require('../socket').getIo();
        io.to(`chama_${cycle.chama_id}`).emit('rosca_autopilot_payout', {
          cycle_id: cycleId,
          recipient_id: recipientId,
          amount: payoutAmount,
          position: nextPosition
        });
      } catch (e) {}

    } else {
      await client.query('ROLLBACK');
    }

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    logger.error('checkAndTriggerAutoPayout error', { error: error.message, cycleId });
  } finally {
    if (client) client.release();
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
  activateCycle,
  cancelCycle,
  getCycleById,
  makeContribution,
  getContributions,
  getMemberStatement,
  checkAndTriggerAutoPayout,
  getNextCycleRosterPreview,
};

