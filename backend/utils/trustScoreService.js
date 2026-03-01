const pool = require('../config/db');
const logger = require('./logger');

/**
 * Trust Score Service
 * Calculates member reliability based on contributions, attendance, and loan performance.
 */
class TrustScoreService {
  /**
   * Update trust score for a specific member
   * @param {number} chamaId 
   * @param {number} userId 
   */
  static async updateMemberTrustScore(chamaId, userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 0. Fetch Chama & Member Details for baseline
      const metaRes = await client.query(`
        SELECT c.contribution_frequency, c.contribution_amount, cm.joined_at, cm.role
        FROM chamas c
        JOIN chama_members cm ON c.chama_id = cm.chama_id
        WHERE c.chama_id = $1 AND cm.user_id = $2
      `, [chamaId, userId]);

      if (metaRes.rowCount === 0) throw new Error('Member not found');
      const { contribution_frequency, joined_at } = metaRes.rows[0];

      // 1. Contribution Reliability (50%)
      // logic: [Actual Verified] / [Expected since joining]
      const joinedDate = new Date(joined_at);
      const now = new Date();
      const monthsDiff = (now.getFullYear() - joinedDate.getFullYear()) * 12 + (now.getMonth() - joinedDate.getMonth());
      const weeksDiff = Math.floor((now - joinedDate) / (7 * 24 * 60 * 60 * 1000));
      
      let expectedCount = 1; // Default to at least 1 for the joining period
      if (contribution_frequency === 'WEEKLY') expectedCount = Math.max(1, weeksDiff);
      else if (contribution_frequency === 'BIWEEKLY') expectedCount = Math.max(1, Math.floor(weeksDiff / 2));
      else if (contribution_frequency === 'MONTHLY') expectedCount = Math.max(1, monthsDiff);
      else if (contribution_frequency === 'QUARTERLY') expectedCount = Math.max(1, Math.floor(monthsDiff / 3));

      const contributionRes = await client.query(`
        SELECT COUNT(*) as count
        FROM contributions 
        WHERE chama_id = $1 AND user_id = $2 AND status = 'VERIFIED'
      `, [chamaId, userId]);

      const actualCount = parseInt(contributionRes.rows[0].count) || 0;
      const contributionScore = Math.min((actualCount / expectedCount) * 100, 100);

      // 2. Attendance Presence (20%)
      // logic: Last 5 meetings only (recency bias)
      const attendanceRes = await client.query(`
        SELECT status
        FROM meeting_attendance ma
        JOIN meetings m ON ma.meeting_id = m.meeting_id
        WHERE m.chama_id = $1 AND ma.user_id = $2
        ORDER BY m.scheduled_date DESC
        LIMIT 5
      `, [chamaId, userId]);

      let attendanceScore = 100;
      if (attendanceRes.rows.length > 0) {
        const presentCount = attendanceRes.rows.filter(r => r.status === 'PRESENT').length;
        attendanceScore = (presentCount / attendanceRes.rows.length) * 100;
      }

      // 3. Loan Discipline (30%)
      const loanRes = await client.query(`
        SELECT status, due_date, 
               (SELECT MAX(payment_date) FROM loan_repayments lr WHERE lr.loan_id = l.loan_id) as last_payment
        FROM loans l
        WHERE chama_id = $1 AND user_id = $2 AND status IN ('ACTIVE', 'REPAID', 'DEFAULTED')
      `, [chamaId, userId]);

      let loanScore = 100;
      if (loanRes.rows.length > 0) {
        let penalties = 0;
        for (const loan of loanRes.rows) {
          if (loan.status === 'DEFAULTED') penalties += 60;
          if (loan.last_payment && new Date(loan.last_payment) > new Date(loan.due_date)) penalties += 20;
          // Check if current active loan is overdue
          if (loan.status === 'ACTIVE' && new Date(loan.due_date) < now) penalties += 10;
        }
        loanScore = Math.max(0, 100 - penalties);
      }

      // 4. Final Weighted Calculation
      const finalScore = Math.round(
        (contributionScore * 0.5) + 
        (attendanceScore * 0.2) + 
        (loanScore * 0.3)
      );

      // Update Database
      await client.query(`
        UPDATE chama_members 
        SET trust_score = $1, updated_at = NOW()
        WHERE chama_id = $2 AND user_id = $3
      `, [finalScore, chamaId, userId]);

      await client.query('COMMIT');
      return finalScore;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('TrustScore Engine Error:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Batch update all members in a chama
   */
  static async analyzeChamaReliability(chamaId) {
    const members = await pool.query('SELECT user_id FROM chama_members WHERE chama_id = $1', [chamaId]);
    const results = [];
    for (const member of members.rows) {
      const score = await this.updateMemberTrustScore(chamaId, member.user_id);
      results.push({ userId: member.user_id, score });
    }
    return results;
  }
}

module.exports = TrustScoreService;
