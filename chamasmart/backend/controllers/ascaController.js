const pool = require("../config/db");
const { isValidAmount, isValidPaymentMethod } = require("../utils/validators");
const logger = require("../utils/logger");

// Ensure chama is ASCA and active
const getAscaChama = async (chamaId) => {
  const result = await pool.query(
    "SELECT chama_id, chama_type, current_fund, share_price FROM chamas WHERE chama_id = $1 AND is_active = true",
    [chamaId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Chama not found");
    error.status = 404;
    throw error;
  }

  const chama = result.rows[0];
  if (chama.chama_type !== "ASCA") {
    const error = new Error("This operation is only available for ASCA chamas");
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
        message: "Amount must be a positive number",
      });
    }

    // Normalize and validate payment method; default to CASH when not provided
    const resolvedPaymentMethod = paymentMethod
      ? String(paymentMethod).toUpperCase()
      : "CASH";

    if (!isValidPaymentMethod(resolvedPaymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    const chama = await getAscaChama(chamaId);

    // Determine base share price: prefer explicit share_price, fallback to contribution_amount
    const priceResult = await pool.query(
      "SELECT contribution_amount, share_price FROM chamas WHERE chama_id = $1",
      [chamaId]
    );
    const row = priceResult.rows[0];
    const basePrice = parseFloat(row.share_price || row.contribution_amount || 0);

    if (!basePrice || basePrice <= 0) {
      return res.status(400).json({
        success: false,
        message: "Share price is not configured for this ASCA chama",
      });
    }

    const sharesBought = parseFloat(amount) / basePrice;

    await client.query("BEGIN");

    // Ensure user is a member
    const memberCheck = await client.query(
      "SELECT user_id FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true",
      [chamaId, userId]
    );

    if (memberCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "User is not a member of this chama",
      });
    }

    // 1) Record a normal contribution for compatibility with existing stats
    const contributionInsert = await client.query(
      `INSERT INTO contributions 
       (chama_id, user_id, amount, payment_method, recorded_by, contribution_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING contribution_id, amount, payment_method, contribution_date`,
      [
        chamaId,
        userId,
        amount,
        resolvedPaymentMethod,
        userId,
        new Date(),
      ]
    );

    // 2) Update chama fund and member total contributions
    await client.query(
      "UPDATE chamas SET current_fund = current_fund + $1 WHERE chama_id = $2",
      [amount, chamaId]
    );

    await client.query(
      "UPDATE chama_members SET total_contributions = total_contributions + $1 WHERE chama_id = $2 AND user_id = $3",
      [amount, chamaId, userId]
    );

    // 3) Record share purchase in ASCA ledger
    const shareInsert = await client.query(
      `INSERT INTO asca_share_contributions (user_id, chama_id, amount, number_of_shares)
       VALUES ($1, $2, $3, $4)
       RETURNING id, amount, number_of_shares, transaction_date`,
      [userId, chamaId, amount, sharesBought]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Shares purchased successfully",
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
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        // ignore rollback errors in error path
      }
    }
    logger.logError(err, { context: "asca_buyShares", chamaId, userId });
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
      [chamaId, userId]
    );

    const { total_amount, total_shares } = userAgg.rows[0];

    // Chama-wide totals and assets
    const [chamaRow, sharesAgg, assetsAgg] = await Promise.all([
      pool.query(
        "SELECT current_fund, share_price FROM chamas WHERE chama_id = $1",
        [chamaId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(number_of_shares), 0) AS total_shares
         FROM asca_share_contributions
         WHERE chama_id = $1`,
        [chamaId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(current_valuation), 0) AS total_assets
         FROM assets
         WHERE chama_id = $1`,
        [chamaId]
      ),
    ]);

    if (chamaRow.rows.length === 0) {
      const error = new Error("Chama not found");
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
    logger.logError(err, { context: "asca_getMyEquity", chamaId, userId });
    return next(err);
  }
};

module.exports = {
  buyShares,
  getMyEquity,
};
