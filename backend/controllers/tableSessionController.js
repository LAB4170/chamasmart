/**
 * Table Banking Session Controller
 * Manages the "Live Meeting" financial lifecycle (Opening, Activity, Locking, Closing)
 */

const pool = require('../config/db');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

// 1. OPEN SESSION
const openSession = async (req, res, next) => {
  const { chamaId, meetingId } = req.params;
  const { openingCash } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify meeting exists and belongs to chama
    const meetingRes = await client.query(
      'SELECT meeting_id, session_status FROM meetings WHERE meeting_id = $1 AND chama_id = $2 FOR UPDATE',
      [meetingId, chamaId]
    );

    if (meetingRes.rows.length === 0) {
      throw new AppError('Meeting not found', 404);
    }

    if (meetingRes.rows[0].session_status !== 'NOT_STARTED') {
      throw new AppError('Session already started or closed', 400);
    }

    // Update meeting to OPEN
    await client.query(
      `UPDATE meetings 
       SET session_status = 'OPEN', 
           opening_cash = $1, 
           session_opened_at = NOW() 
       WHERE meeting_id = $2`,
      [openingCash || 0, meetingId]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Meeting session opened successfully',
      data: { meetingId, status: 'OPEN', openingCash }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// 2. GET SESSION DASHBOARD DATA
const getSessionData = async (req, res, next) => {
  const { chamaId, meetingId } = req.params;

  try {
    // Get meeting info
    const meetingRes = await pool.query(
      'SELECT * FROM meetings WHERE meeting_id = $1 AND chama_id = $2',
      [meetingId, chamaId]
    );

    if (meetingRes.rows.length === 0) throw new AppError('Meeting not found', 404);

    // Get all members with their session activity
    const activityRes = await pool.query(
      `SELECT 
        u.user_id, 
        u.first_name || ' ' || u.last_name as full_name,
        cm.role,
        (SELECT attended FROM meeting_attendance WHERE meeting_id = $1 AND user_id = u.user_id) as attended,
        COALESCE((SELECT SUM(amount) FROM contributions WHERE meeting_id = $1 AND user_id = u.user_id), 0) as total_contribution,
        COALESCE((SELECT SUM(amount) FROM loan_repayments WHERE meeting_id = $1 AND payer_id = u.user_id), 0) as total_repayment,
        COALESCE((SELECT approved_amount FROM loans WHERE borrower_id = u.user_id AND created_at::date = (SELECT scheduled_date::date FROM meetings WHERE meeting_id = $1) LIMIT 1), 0) as loan_requested
      FROM chama_members cm
      JOIN users u ON cm.user_id = u.user_id
      WHERE cm.chama_id = $2 AND cm.is_active = true
      ORDER BY u.first_name ASC`,
      [meetingId, chamaId]
    );

    res.status(200).json({
      success: true,
      data: {
        meeting: meetingRes.rows[0],
        activities: activityRes.rows
      }
    });
  } catch (err) {
    next(err);
  }
};

// 3. CLOSE SESSION (Hard-Lock Reconciliation Enforcement)
const closeSession = async (req, res, next) => {
  const { chamaId, meetingId } = req.params;
  const { physical_cash_count, discrepancy_note } = req.body;

  if (physical_cash_count === undefined || physical_cash_count === null) {
    return res.status(400).json({ success: false, message: "Physical cash count is required to close a session." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock meeting row for reconciliation calculation
    const sessionRes = await client.query(
      `SELECT m.opening_cash, m.total_collections, m.total_disbursements, m.session_status, m.title
       FROM meetings m 
       WHERE m.meeting_id = $1 AND m.chama_id = $2 
       FOR UPDATE`,
      [meetingId, chamaId]
    );

    if (sessionRes.rows.length === 0) throw new AppError("Meeting not found", 404);
    if (sessionRes.rows[0].session_status !== "OPEN") throw new AppError("Session is not currently open and cannot be closed", 400);

    const { opening_cash, total_collections, total_disbursements, title } = sessionRes.rows[0];
    
    // Formula: Opening + All Collected In-Session - All Disbursed In-Session
    const expected_cash = parseFloat(opening_cash) + parseFloat(total_collections) - parseFloat(total_disbursements);
    const physical = parseFloat(physical_cash_count);
    const discrepancy = Math.abs(physical - expected_cash);

    // ZERO TOLERANCE: Any discrepancy > 0.00 prevents closure
    if (discrepancy > 0.00) {
      await client.query("ROLLBACK");
      logger.warn("Reconciliation failed: session closure blocked", { 
        meetingId, chamaId, expected: expected_cash, physical, discrepancy 
      });
      
      return res.status(400).json({
        success: false,
        message: "RECONCILIATION FAILED: Physical cash does not equal the system ledger. Treasurer must reconcile all missing or excess cash before the session can be closed.",
        error_code: "HARD_LOCK_RECONCILIATION_FAILED",
        data: {
          expected_cash: expected_cash.toFixed(2),
          physical_cash_count: physical.toFixed(2),
          discrepancy_amount: discrepancy.toFixed(2),
          breakdown: {
            opening_cash: parseFloat(opening_cash).toFixed(2),
            total_collections: parseFloat(total_collections).toFixed(2),
            total_disbursements: parseFloat(total_disbursements).toFixed(2)
          }
        }
      });
    }

    // If reconciled, set status to CLOSED
    const meetingRes = await client.query(
      `UPDATE meetings 
       SET session_status = 'CLOSED',
           closing_cash = $1,
           session_closed_at = NOW(),
           closed_by = $2,
           physical_cash_count = $3,
           expected_cash = $4,
           discrepancy_amount = 0,
           discrepancy_note = $5,
           reconciliation_status = 'MATCHED'
       WHERE meeting_id = $6 AND chama_id = $7
       RETURNING *`,
      [physical, req.user.user_id, physical, expected_cash, discrepancy_note || null, meetingId, chamaId]
    );

    await client.query("COMMIT");
    
    logger.info("Session closed successfully - reconciled ✅", { 
      meetingId, chamaId, closedBy: req.user.user_id, finalCash: physical 
    });

    res.status(200).json({
      success: true,
      message: `Session for "${title}" successfully closed and reconciled. ✅`,
      data: meetingRes.rows[0]
    });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
};

// 4. ADD LIVE PENALTY (Phase 22: Live Penalty Clock)
const addLivePenalty = async (req, res, next) => {
  const { chamaId, meetingId } = req.params;
  const { user_id, penalty_type, amount, note } = req.body;

  if (!user_id || !penalty_type || !amount) {
    return res.status(400).json({ success: false, message: 'user_id, penalty_type, and amount are required.' });
  }

  try {
    // Verify session is OPEN
    const sessionRes = await pool.query(
      'SELECT session_status FROM meetings WHERE meeting_id = $1 AND chama_id = $2',
      [meetingId, chamaId]
    );
    if (sessionRes.rows.length === 0) throw new AppError('Meeting not found', 404);
    if (sessionRes.rows[0].session_status !== 'OPEN') {
      throw new AppError('Can only add penalties to an open session', 400);
    }

    const result = await pool.query(
      `INSERT INTO session_penalties (meeting_id, user_id, penalty_type, amount, note, added_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [meetingId, user_id, penalty_type.toUpperCase(), parseFloat(amount), note || null, req.user.user_id]
    );

    res.status(201).json({ success: true, message: 'Penalty added.', data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// 5. GET SESSION PENALTIES (Phase 22)
const getSessionPenalties = async (req, res, next) => {
  const { meetingId } = req.params;
  try {
    const result = await pool.query(
      `SELECT sp.*, u.first_name || ' ' || u.last_name AS member_name
       FROM session_penalties sp
       JOIN users u ON u.user_id = sp.user_id
       WHERE sp.meeting_id = $1
       ORDER BY sp.created_at DESC`,
      [meetingId]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  openSession,
  getSessionData,
  closeSession,
  addLivePenalty,
  getSessionPenalties,
};
