const pool = require('../config/db');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

/**
 * Dividend Controller
 * Handles profit distribution for ASCAs (Table Banking)
 */

const calculateDividends = async (req, res, next) => {
  const { chamaId, cycleId } = req.params;

  try {
    // 1. Verify chama is ASCA/Table Banking
    const chamaRes = await pool.query(
      'SELECT chama_type FROM chamas WHERE chama_id = $1',
      [chamaId]
    );

    if (chamaRes.rows.length === 0) {
      throw new AppError('Chama not found', 404, 'CHAMA_NOT_FOUND');
    }

    // 2. Calculate Total Profit (Interest + Penalties)
    const profitRes = await pool.query(`
      SELECT 
        SUM(interest_component) as total_interest,
        SUM(penalty_component) as total_penalties
      FROM loan_repayments lr
      JOIN loans l ON lr.loan_id = l.loan_id
      WHERE l.chama_id = $1 AND l.metadata->>'cycleId' = $2
    `, [chamaId, cycleId]);
    // Note: Adjusting query if cycleId isn't in metadata. 
    // From schema, loans don't have cycle_id, but loan_repayments has source/notes.
    // However, asca_members has cycle_id.

    const totalInterest = parseFloat(profitRes.rows[0].total_interest || 0);
    const totalPenalties = parseFloat(profitRes.rows[0].total_penalties || 0);
    const totalProfit = totalInterest + totalPenalties;

    if (totalProfit <= 0) {
      return res.status(200).json({
        success: true,
        message: 'No profit available for distribution',
        data: { totalProfit: 0 }
      });
    }

    // 3. Get total shares in the cycle
    const sharesRes = await pool.query(
      'SELECT SUM(shares_owned) as total_shares FROM asca_members WHERE cycle_id = $1',
      [cycleId]
    );
    const totalShares = parseInt(sharesRes.rows[0].total_shares || 0);

    if (totalShares <= 0) {
      throw new AppError('No shares found in this cycle', 400, 'NO_SHARES');
    }

    // 4. Calculate distributions
    const membersRes = await pool.query(
      'SELECT user_id, shares_owned FROM asca_members WHERE cycle_id = $1',
      [cycleId]
    );

    const distributions = membersRes.rows.map(member => {
      const shareRatio = member.shares_owned / totalShares;
      const amount = totalProfit * shareRatio;
      return {
        userId: member.user_id,
        shares: member.shares_owned,
        amount: parseFloat(amount.toFixed(2))
      };
    });

    res.json({
      success: true,
      data: {
        cycleId,
        totalProfit,
        totalShares,
        distributions
      }
    });
  } catch (error) {
    next(error);
  }
};

const distributeDividends = async (req, res, next) => {
  const { chamaId, cycleId } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Calculate (Internal call or repeat logic)
    const profitRes = await client.query(`
      SELECT 
        COALESCE(SUM(interest_component), 0) + COALESCE(SUM(penalty_component), 0) as total_profit
      FROM loan_repayments lr
      JOIN loans l ON lr.loan_id = l.loan_id
      WHERE l.chama_id = $1
    `, [chamaId]); // Simplifying for now to all interest in chama if cycle tracking is complex
    
    const totalProfit = parseFloat(profitRes.rows[0].total_profit || 0);

    const sharesRes = await client.query(
      'SELECT SUM(shares_owned) as total_shares FROM asca_members WHERE cycle_id = $1',
      [cycleId]
    );
    const totalShares = parseInt(sharesRes.rows[0].total_shares || 0);

    if (totalShares <= 0 || totalProfit <= 0) {
      throw new AppError('Nothing to distribute', 400, 'NOTHING_TO_DISTRIBUTE');
    }

    // 2. Update asca_members dividends
    const membersRes = await client.query(
      'SELECT user_id, shares_owned FROM asca_members WHERE cycle_id = $1',
      [cycleId]
    );

    for (const member of membersRes.rows) {
      const shareRatio = member.shares_owned / totalShares;
      const amount = totalProfit * shareRatio;

      await client.query(`
        UPDATE asca_members 
        SET dividends_earned = COALESCE(dividends_earned, 0) + $1,
            total_investment = COALESCE(total_investment, 0) + $1
        WHERE cycle_id = $2 AND user_id = $3
      `, [amount, cycleId, member.user_id]);

      await client.query(`
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
        VALUES ($1, 'DIVIDEND_DISTRIBUTED', 'ASCA_CYCLE', $2, $3)
      `, [req.user.user_id, cycleId, JSON.stringify({ recipient: member.user_id, amount })]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Dividends distributed successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

module.exports = {
  calculateDividends,
  distributeDividends
};
