const pool = require('../config/db');
const { AppError } = require('../middleware/errorHandler');

/**
 * Report Controller
 * Generates audit-ready reports for Chamas
 */

const getAuditReport = async (req, res, next) => {
  const { chamaId } = req.params;

  try {
    // 1. Get Chama Details
    const chamaRes = await pool.query(
      'SELECT chama_name, created_at, current_fund FROM chamas WHERE chama_id = $1',
      [chamaId]
    );

    if (chamaRes.rows.length === 0) {
      throw new AppError('Chama not found', 404, 'NOT_FOUND');
    }

    // 2. Get Meetings Summary (Attendance + Minutes)
    const meetingsRes = await pool.query(`
      SELECT 
        m.meeting_id, m.title, m.scheduled_date, m.location, m.minutes,
        (SELECT COUNT(*) FROM meeting_attendance WHERE meeting_id = m.meeting_id AND attended = true) as present,
        (SELECT COUNT(*) FROM meeting_attendance WHERE meeting_id = m.meeting_id AND attended = false) as absent
      FROM meetings m
      WHERE m.chama_id = $1
      ORDER BY m.scheduled_date DESC
    `, [chamaId]);

    // 3. Get Financial Summary
    const financesRes = await pool.query(`
      SELECT 
        u.first_name || ' ' || u.last_name as member_name,
        cm.role,
        cm.total_contributions
      FROM chama_members cm
      JOIN users u ON cm.user_id = u.user_id
      WHERE cm.chama_id = $1 AND cm.is_active = true
      ORDER BY cm.total_contributions DESC
    `, [chamaId]);

    // 4. Get Loan Summary
    const loansRes = await pool.query(`
      SELECT 
        u.first_name || ' ' || u.last_name as borrower,
        l.loan_amount, l.interest_rate, l.status, l.total_repayable,
        l.principal_outstanding + l.interest_outstanding + l.penalty_outstanding as total_outstanding
      FROM loans l
      JOIN users u ON l.borrower_id = u.user_id
      WHERE l.chama_id = $1 AND l.status IN ('ACTIVE', 'DEFAULTED')
    `, [chamaId]);

    res.json({
      success: true,
      data: {
        chama: chamaRes.rows[0],
        meetings: meetingsRes.rows,
        finances: financesRes.rows,
        loans: loansRes.rows,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditReport
};
