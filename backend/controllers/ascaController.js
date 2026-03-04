const pool = require('../config/db');
const { isValidAmount, isValidPaymentMethod } = require('../utils/validators');
const logger = require('../utils/logger');
const { clearChamaCache } = require('../utils/cache');

// Ensure chama is ASCA and active
const getAscaChama = async chamaId => {
  const result = await pool.query(
    'SELECT chama_id, chama_type, current_fund, share_price FROM chamas WHERE chama_id = $1 AND is_active = true',
    [chamaId],
  );

  if (result.rows.length === 0) {
    const error = new Error('Chama not found');
    error.status = 404;
    throw error;
  }

  const chama = result.rows[0];
  if (chama.chama_type !== 'ASCA') {
    const error = new Error('This operation is only available for ASCA chamas');
    error.status = 400;
    throw error;
  }

  return chama;
};

// POST /api/asca/:chamaId/buy-shares
// Body: { amount, paymentMethod? }
const buyShares = async (req, res, next) => {
  let client;
  let chamaId;
  let userId;

  try {
    client = await pool.connect();
    ({ chamaId } = req.params);
    const { amount, paymentMethod } = req.body;
    userId = req.user.user_id;

    if (!amount || !isValidAmount(amount)) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number',
      });
    }

    // Normalize and validate payment method; default to CASH when not provided
    const resolvedPaymentMethod = paymentMethod
      ? String(paymentMethod).toUpperCase()
      : 'CASH';

    if (!isValidPaymentMethod(resolvedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method',
      });
    }

    const chama = await getAscaChama(chamaId);

    // 0) Find active cycle
    const cycleRes = await client.query(
      'SELECT cycle_id, share_price FROM asca_cycles WHERE chama_id = $1 AND status = \'ACTIVE\'',
      [chamaId],
    );

    if (cycleRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'No active ASCA cycle found. Ask an official to start a new cycle.',
      });
    }

    const { cycle_id: cycleId, share_price: cycleSharePrice } = cycleRes.rows[0];
    const basePrice = parseFloat(cycleSharePrice || chama.share_price || 0);

    if (!basePrice || basePrice <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Share price is not configured for this cycle',
      });
    }

    const sharesBought = parseFloat(amount) / basePrice;

    await client.query('BEGIN');

    // Ensure user is a member
    const memberCheck = await client.query(
      'SELECT user_id FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true',
      [chamaId, userId],
    );

    if (memberCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'User is not a member of this chama',
      });
    }

    // 1) Record a normal contribution for compatibility with existing stats
    const contributionInsert = await client.query(
      `INSERT INTO contributions 
       (chama_id, user_id, amount, payment_method, recorded_by, contribution_date, cycle_id, contribution_type, status, verification_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ASCA_SHARE', 'COMPLETED', 'VERIFIED')
       RETURNING contribution_id, amount, payment_method, contribution_date`,
      [
        chamaId,
        userId,
        amount,
        resolvedPaymentMethod,
        userId,
        new Date(),
        cycleId,
      ],
    );

    // 2) Update chama fund and member total contributions
    await client.query(
      'UPDATE chamas SET current_fund = current_fund + $1 WHERE chama_id = $2',
      [amount, chamaId],
    );

    await client.query(
      'UPDATE chama_members SET total_contributions = total_contributions + $1 WHERE chama_id = $2 AND user_id = $3',
      [amount, chamaId, userId],
    );

    // 3) Record share purchase in ASCA ledger
    const shareInsert = await client.query(
      `INSERT INTO asca_share_contributions (user_id, chama_id, cycle_id, amount, number_of_shares)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, amount, number_of_shares, transaction_date`,
      [userId, chamaId, cycleId, amount, sharesBought],
    );

    // 4) Upsert into asca_members for dividend tracking
    await client.query(
      `INSERT INTO asca_members (user_id, cycle_id, shares_owned, total_investment, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       ON CONFLICT (user_id, cycle_id) 
       DO UPDATE SET 
         shares_owned = asca_members.shares_owned + EXCLUDED.shares_owned,
         total_investment = asca_members.total_investment + EXCLUDED.total_investment`,
      [userId, cycleId, sharesBought, amount],
    );

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Shares purchased successfully',
      data: {
        contribution: contributionInsert.rows[0],
        sharePurchase: shareInsert.rows[0],
        sharePrice: basePrice,
        sharesBought,
      },
    });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        // ignore rollback errors in error path
      }
    }
    logger.logError(err, { context: 'asca_buyShares', chamaId, userId });
    return next(err);
  } finally {
    if (client) {
      client.release();
    }
  }
};

// GET /api/asca/:chamaId/equity
// Returns current equity for the authenticated user in an ASCA chama
const getMyEquity = async (req, res, next) => {
  let chamaId;
  let userId;

  try {
    ({ chamaId } = req.params);
    userId = req.user.user_id;

    await getAscaChama(chamaId); // validates chama and type

    // User totals
    const userAgg = await pool.query(
      `SELECT 
         COALESCE(SUM(amount), 0) AS total_amount,
         COALESCE(SUM(number_of_shares), 0) AS total_shares
       FROM asca_share_contributions
       WHERE chama_id = $1 AND user_id = $2`,
      [chamaId, userId],
    );

    const { total_amount, total_shares } = userAgg.rows[0];

    // Chama-wide totals and assets
    const [chamaRow, sharesAgg, assetsAgg] = await Promise.all([
      pool.query(
        'SELECT current_fund, share_price FROM chamas WHERE chama_id = $1',
        [chamaId],
      ),
      pool.query(
        `SELECT COALESCE(SUM(number_of_shares), 0) AS total_shares
         FROM asca_share_contributions
         WHERE chama_id = $1`,
        [chamaId],
      ),
      pool.query(
        `SELECT COALESCE(SUM(current_valuation), 0) AS total_assets
         FROM assets
         WHERE chama_id = $1`,
        [chamaId],
      ),
    ]);

    if (chamaRow.rows.length === 0) {
      const error = new Error('Chama not found');
      error.status = 404;
      throw error;
    }

    const currentFund = parseFloat(chamaRow.rows[0].current_fund || 0);
    const configuredSharePrice = parseFloat(chamaRow.rows[0].share_price || 0);
    const totalSharesChama = parseFloat(sharesAgg.rows[0].total_shares || 0);
    const assetsValue = parseFloat(assetsAgg.rows[0].total_assets || 0);

    const totalAssets = currentFund + assetsValue;

    let currentSharePrice;
    if (totalSharesChama > 0) {
      currentSharePrice = totalAssets / totalSharesChama;
    } else {
      currentSharePrice = configuredSharePrice || 0;
    }

    const estimatedValue = parseFloat(total_shares || 0) * currentSharePrice;

    return res.json({
      success: true,
      data: {
        totalAmount: parseFloat(total_amount || 0),
        totalShares: parseFloat(total_shares || 0),
        currentSharePrice,
        estimatedValue,
        totalAssets,
      },
    });
  } catch (err) {
    logger.logError(err, { context: 'asca_getMyEquity', chamaId, userId });
    return next(err);
  }
};

// POST /api/asca/:chamaId/cycles
// Body: { cycle_name, start_date, end_date, share_price, total_shares? }
const createAscaCycle = async (req, res, next) => {
  let chamaId;
  let userId;

  try {
    ({ chamaId } = req.params);
    const { cycle_name, start_date, end_date, share_price, total_shares } = req.body;
    userId = req.user.user_id;

    // Check if user is official
    const officialCheck = await pool.query(
      'SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND role IN (\'CHAIRPERSON\', \'TREASURER\', \'SECRETARY\') AND is_active = true',
      [chamaId, userId],
    );

    if (officialCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Only officials can create cycles',
      });
    }

    // Check for existing active cycle
    const activeCycle = await pool.query(
      'SELECT cycle_id FROM asca_cycles WHERE chama_id = $1 AND status = \'ACTIVE\'',
      [chamaId],
    );

    if (activeCycle.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An active cycle already exists for this chama. Close it before starting a new one.',
      });
    }

    const result = await pool.query(
      `INSERT INTO asca_cycles (chama_id, cycle_name, start_date, end_date, share_price, total_shares, available_shares, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
       RETURNING *`,
      [chamaId, cycle_name, start_date, end_date, share_price, total_shares || 0, total_shares || 0],
    );

    // Update chama share_price for consistency
    await pool.query(
      'UPDATE chamas SET share_price = $1 WHERE chama_id = $2',
      [share_price, chamaId],
    );

    return res.status(201).json({
      success: true,
      message: 'ASCA Cycle created successfully',
      data: result.rows[0],
    });
  } catch (err) {
    logger.logError(err, { context: 'asca_createCycle', chamaId, userId });
    return next(err);
  }
};

// POST /api/asca/:chamaId/cycles/:cycleId/close
// Body: {}
const closeAscaCycle = async (req, res, next) => {
  let client;
  let chamaId;
  let cycleId;
  let userId;

  try {
    client = await pool.connect();
    ({ chamaId, cycleId } = req.params);
    userId = req.user.user_id;

    // Check if user is official
    const officialCheck = await pool.query(
      "SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND role IN ('CHAIRPERSON', 'TREASURER', 'SECRETARY') AND is_active = true",
      [chamaId, userId],
    );

    if (officialCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Only officials can close cycles',
      });
    }

    await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');

    // Check for existing active cycle
    const activeCycle = await client.query(
      "SELECT cycle_id FROM asca_cycles WHERE chama_id = $1 AND cycle_id = $2 AND status = 'ACTIVE'",
      [chamaId, cycleId],
    );

    if (activeCycle.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cycle is not active or does not exist.',
      });
    }

    // Calculate Total Profit (Interest + Penalties)
    const profitRes = await client.query(`
      SELECT 
        COALESCE(SUM(lr.interest_component), 0) + COALESCE(SUM(lr.penalty_component), 0) as total_profit
      FROM loan_repayments lr
      JOIN loans l ON lr.loan_id = l.loan_id
      WHERE l.chama_id = $1
    `, [chamaId]);

    const totalProfit = parseFloat(profitRes.rows[0].total_profit || 0);

    const sharesRes = await client.query(
      'SELECT COALESCE(SUM(shares_owned), 0) as total_shares FROM asca_members WHERE cycle_id = $1',
      [cycleId]
    );

    const totalShares = parseFloat(sharesRes.rows[0].total_shares || 0);

    if (totalShares > 0 && totalProfit > 0) {
      // Calculate distributions
      const membersRes = await client.query(
        'SELECT user_id, shares_owned FROM asca_members WHERE cycle_id = $1',
        [cycleId]
      );

      for (const member of membersRes.rows) {
        if (member.shares_owned > 0) {
          const shareRatio = member.shares_owned / totalShares;
          const amount = totalProfit * shareRatio;
  
          await client.query(`
            UPDATE asca_members 
            SET dividends_earned = COALESCE(dividends_earned, 0) + $1
            WHERE cycle_id = $2 AND user_id = $3
          `, [amount, cycleId, member.user_id]);
        }
      }
    }

    // Update cycle status
    await client.query(
      "UPDATE asca_cycles SET status = 'CLOSED_PENDING_PAYOUT' WHERE cycle_id = $1",
      [cycleId]
    );

    await client.query('COMMIT');

    // Invalidate Cache
    clearChamaCache(chamaId);

    return res.status(200).json({
      success: true,
      message: 'ASCA Cycle closed successfully. Final dividends calculated.',
      data: {
        cycleId,
        totalProfit,
        totalShares
      }
    });

  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {}
    }
    logger.logError(err, { context: 'asca_closeCycle', chamaId, cycleId, userId });
    return next(err);
  } finally {
    if (client) {
      client.release();
    }
  }
};

const executeShareOutPayout = async (req, res, next) => {
  let client;
  let chamaId;
  let cycleId;
  let userId;

  try {
    client = await pool.connect();
    chamaId = parseInt(req.params.chamaId, 10);
    cycleId = parseInt(req.params.cycleId, 10);
    userId = req.user.user_id;

    // Verify Official Role
    const memberRes = await client.query(
      'SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true',
      [chamaId, userId]
    );

    if (
      memberRes.rows.length === 0 ||
      !['CHAIRPERSON', 'TREASURER', 'SECRETARY'].includes(memberRes.rows[0].role.toUpperCase())
    ) {
      return res.status(403).json({
        success: false,
        message: 'Only officials can execute a share-out payout.',
      });
    }

    await client.query('BEGIN');

    // 1. Verify exact cycle state
    const cycleRes = await client.query(
      'SELECT status FROM asca_cycles WHERE cycle_id = $1 AND chama_id = $2 FOR UPDATE',
      [cycleId, chamaId]
    );

    if (cycleRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'ASCA Cycle not found.' });
    }

    if (cycleRes.rows[0].status !== 'CLOSED_PENDING_PAYOUT') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cycle is not in CLOSED_PENDING_PAYOUT status.' });
    }

    // 2. Calculate Total Liability
    const liabilityRes = await client.query(
      'SELECT COALESCE(SUM(total_investment + dividends_earned), 0) as total_liability FROM asca_members WHERE cycle_id = $1',
      [cycleId]
    );
    const totalLiability = parseFloat(liabilityRes.rows[0].total_liability);

    // 3. Verify Chama Funds
    const chamaRes = await client.query(
      'SELECT current_fund FROM chamas WHERE chama_id = $1 FOR UPDATE',
      [chamaId]
    );
    const currentFund = parseFloat(chamaRes.rows[0].current_fund);

    if (currentFund < totalLiability) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Insufficient Chama funds. Liability is ${totalLiability} KES but current fund is ${currentFund} KES.`,
      });
    }

    // 4. Deduct Chama Funds
    await client.query(
      'UPDATE chamas SET current_fund = current_fund - $1 WHERE chama_id = $2',
      [totalLiability, chamaId]
    );

    // 5. Update Cycle Status
    await client.query(
      "UPDATE asca_cycles SET status = 'COMPLETED' WHERE cycle_id = $1",
      [cycleId]
    );

    await client.query('COMMIT');

    // Invalidate Cache
    clearChamaCache(chamaId);

    return res.status(200).json({
      success: true,
      message: 'Payout executed successfully. Cycle is now COMPLETED.',
      data: {
        cycleId,
        totalPayout: totalLiability,
        remainingFund: currentFund - totalLiability
      }
    });

  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (e) {}
    }
    logger.logError(err, { context: 'asca_executePayout', chamaId, cycleId, userId });
    return next(err);
  } finally {
    if (client) {
      client.release();
    }
  }
};

/**
 * @desc    Get ASCA reports summary
 * @route   GET /api/asca/:chamaId/reports/summary
 */
const getAscaReportsSummary = async (req, res, next) => {
  const { chamaId } = req.params;
  const { cycleId } = req.query;
  let client;

  try {
    client = await pool.connect();
    
    // 1. Resolve Cycle ID or get active
    let targetCycleId = cycleId;
    if (!targetCycleId || targetCycleId === 'null' || targetCycleId === 'undefined') {
      const activeCycle = await client.query(
        "SELECT cycle_id, start_date, end_date FROM asca_cycles WHERE chama_id = $1 AND status IN ('ACTIVE', 'CLOSED_PENDING_PAYOUT') ORDER BY created_at DESC LIMIT 1",
        [chamaId]
      );
      if (activeCycle.rows.length === 0) {
        return res.status(200).json({ success: true, data: null, message: 'No active ASCA cycle found.' });
      }
      targetCycleId = activeCycle.rows[0].cycle_id;
    }

    // 2. Aggregate Data
    const cycleRes = await client.query("SELECT * FROM asca_cycles WHERE cycle_id = $1", [targetCycleId]);
    if (cycleRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Cycle not found.' });
    }
    const cycle = cycleRes.rows[0];

    const statsRes = await client.query(`
      SELECT 
        COALESCE(SUM(total_investment), 0) as total_savings,
        COALESCE(SUM(dividends_earned), 0) as total_dividends,
        COUNT(DISTINCT user_id) as member_count
      FROM asca_members 
      WHERE cycle_id = $1`, 
      [targetCycleId]
    );

    const loansRes = await client.query(`
      SELECT 
        COALESCE(SUM(approved_amount), 0) as total_lent,
        COALESCE(SUM(amount_paid), 0) as total_repaid,
        COALESCE(SUM(COALESCE(total_repayable, 0) - COALESCE(approved_amount, 0)), 0) as total_interest_expected
      FROM loans 
      WHERE chama_id = $1 AND status IN ('DISBURSED', 'COMPLETED', 'DEFAULTED')
      AND created_at BETWEEN $2 AND $3`,
      [chamaId, cycle.start_date, cycle.end_date]
    );

    const repaymentRes = await client.query(`
      SELECT 
        COALESCE(SUM(ls.principal_amount), 0) as principal_recovered,
        COALESCE(SUM(ls.interest_amount), 0) as interest_collected
      FROM loan_schedules ls
      JOIN loans l ON ls.loan_id = l.loan_id
      WHERE l.chama_id = $1 AND ls.status = 'PAID'
      AND l.created_at BETWEEN $2 AND $3`,
      [chamaId, cycle.start_date, cycle.end_date]
    );

    // Trends (Monthly Savings)
    const trendsRes = await client.query(`
      SELECT 
        TO_CHAR(transaction_date, 'Mon YYYY') as month,
        SUM(amount) as amount,
        MIN(transaction_date) as sort_date
      FROM asca_share_contributions
      WHERE cycle_id = $1
      GROUP BY 1
      ORDER BY sort_date ASC`,
      [targetCycleId]
    );

    const data = {
      cycle,
      stats: {
        totalSavings: parseFloat(statsRes.rows[0].total_savings),
        totalDividends: parseFloat(statsRes.rows[0].total_dividends),
        memberCount: parseInt(statsRes.rows[0].member_count),
        totalPrincipalLent: parseFloat(loansRes.rows[0].total_lent),
        interestCollected: parseFloat(repaymentRes.rows[0].interest_collected),
        principalRecovered: parseFloat(repaymentRes.rows[0].principal_recovered),
        outstandingBalance: parseFloat(loansRes.rows[0].total_lent) - parseFloat(repaymentRes.rows[0].principal_recovered)
      },
      trends: trendsRes.rows,
      readiness: {
        liquidCash: parseFloat(statsRes.rows[0].total_savings) + parseFloat(repaymentRes.rows[0].interest_collected) - (parseFloat(loansRes.rows[0].total_lent) - parseFloat(repaymentRes.rows[0].principal_recovered)),
        totalEquity: parseFloat(statsRes.rows[0].total_savings) + parseFloat(statsRes.rows[0].total_dividends)
      }
    };

    return res.status(200).json({ success: true, data });

  } catch (err) {
    logger.logError(err, { context: 'getAscaReportsSummary', chamaId, cycleId });
    return next(err);
  } finally {
    if (client) client.release();
  }
};

/**
 * @desc    Get member equity statement (Chronological)
 * @route   GET /api/asca/:chamaId/reports/member-statement
 */
const getMemberEquityStatement = async (req, res, next) => {
    const { chamaId } = req.params;
    const userId = req.user.user_id;
    const { cycleId } = req.query;
    let client;
  
    try {
      client = await pool.connect();
      
      let targetCycleId = cycleId;
      if (!targetCycleId || targetCycleId === 'null' || targetCycleId === 'undefined') {
        const activeCycle = await client.query(
          "SELECT cycle_id FROM asca_cycles WHERE chama_id = $1 AND status IN ('ACTIVE', 'CLOSED_PENDING_PAYOUT') ORDER BY created_at DESC LIMIT 1",
          [chamaId]
        );
        if (activeCycle.rows.length === 0) {
          return res.status(200).json({ success: true, data: [], message: 'No active ASCA cycle found.' });
        }
        targetCycleId = activeCycle.rows[0].cycle_id;
      }
  
      const transactions = await client.query(`
        SELECT 
          'SHARE_PURCHASE' as type,
          amount,
          number_of_shares as detail,
          transaction_date as date
        FROM asca_share_contributions
        WHERE cycle_id = $1 AND user_id = $2
        UNION ALL
        SELECT 
          'DIVIDEND' as type,
          dividends_earned as amount,
          0 as detail,
          created_at as date
        FROM asca_members
        WHERE cycle_id = $1 AND user_id = $2 AND dividends_earned > 0
        ORDER BY date ASC`,
        [targetCycleId, userId]
      );
  
      return res.status(200).json({
        success: true,
        data: transactions.rows
      });
  
    } catch (err) {
      logger.logError(err, { context: 'getMemberEquityStatement', chamaId, userId });
      return next(err);
    } finally {
      if (client) client.release();
    }
  };

module.exports = {
  buyShares,
  getMyEquity,
  createAscaCycle,
  closeAscaCycle,
  executeShareOutPayout,
  getAscaReportsSummary,
  getMemberEquityStatement
};
