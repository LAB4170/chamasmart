const pool = require("../config/db");
const mpesaService = require("../utils/mpesaService");
const logger = require("../utils/logger");
const { getIo } = require("../socket");
const { AppError } = require("../middleware/errorHandler");
const TrustScoreService = require("../utils/trustScoreService");

// Money utility (duplicated for now to avoid cross-controller dependency)
class Money {
  static toCents(amount) {
    if (typeof amount === "string") amount = parseFloat(amount);
    return Math.round(amount * 100);
  }
}

/**
 * Initiate STK Push
 */
const initiatePayment = async (req, res, next) => {
  const { chamaId, amount, phoneNumber, notes } = req.body;
  const userId = req.user.user_id;

  try {
    // 1. Look up chama type + resolve active ROSCA cycle if applicable
    const chamaRes = await pool.query(
      'SELECT chama_type FROM chamas WHERE chama_id = $1',
      [chamaId]
    );
    if (chamaRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Chama not found' });
    }
    const chamaType = chamaRes.rows[0].chama_type;

    let cycleId = null;
    if (chamaType === 'ROSCA') {
      const cycleRes = await pool.query(
        `SELECT cycle_id FROM rosca_cycles 
         WHERE chama_id = $1 AND status IN ('ACTIVE', 'PENDING') 
         ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END, created_at DESC 
         LIMIT 1`,
        [chamaId]
      );
      if (cycleRes.rows.length > 0) cycleId = cycleRes.rows[0].cycle_id;
    }

    // 2. Initiate STK Push via Daraja
    const mpesaRes = await mpesaService.initiateStkPush(
      phoneNumber,
      amount,
      `CHAMA${chamaId}`,
      'Contribution'
    );

    // 3. Log request in mpesa_transactions (with cycle_id for ROSCA)
    await pool.query(
      `INSERT INTO mpesa_transactions 
      (checkout_request_id, user_id, chama_id, amount, phone_number, status, cycle_id)
      VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)`,
      [mpesaRes.CheckoutRequestID, userId, chamaId, amount, phoneNumber, cycleId]
    );

    res.status(200).json({
      success: true,
      message: 'STK Push initiated. Please check your phone.',
      checkoutRequestId: mpesaRes.CheckoutRequestID
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handle M-Pesa Callback
 */
const handleCallback = async (req, res) => {
  const { Body } = req.body;
  
  if (!Body || !Body.stkCallback) {
    return res.status(400).send("Invalid callback payload");
  }

  const {
    MerchantRequestID,
    CheckoutRequestID,
    ResultCode,
    ResultDesc,
    CallbackMetadata
  } = Body.stkCallback;

  logger.info("M-Pesa Callback Received", { CheckoutRequestID, ResultCode });

  const client = await pool.connect();

  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    // 1. Find transaction
    const txRes = await client.query(
      "SELECT * FROM mpesa_transactions WHERE checkout_request_id = $1 FOR UPDATE",
      [CheckoutRequestID]
    );

    if (txRes.rows.length === 0) {
      logger.warn("M-Pesa transaction not found for callback", { CheckoutRequestID });
      await client.query("ROLLBACK");
      return res.status(200).send("Transaction not found"); // Still return 200 to Safaricom
    }

    const transaction = txRes.rows[0];

    // 2. Handle failure
    if (ResultCode !== 0) {
      await client.query(
        "UPDATE mpesa_transactions SET status = 'FAILED', result_code = $1, result_description = $2 WHERE checkout_request_id = $3",
        [ResultCode, ResultDesc, CheckoutRequestID]
      );
      await client.query("COMMIT");
      
      // Notify user via socket
      getIo().to(`chama_${transaction.chama_id}`).emit("payment_failed", {
        userId: transaction.user_id,
        message: ResultDesc
      });

      return res.status(200).send("Failure recorded");
    }

    // 3. Handle Success
    const metadata = CallbackMetadata.Item;
    const amountItem = metadata.find(i => i.Name === "Amount");
    const receiptItem = metadata.find(i => i.Name === "MpesaReceiptNumber");
    
    const amount = amountItem ? amountItem.Value : transaction.amount;
    const receipt = receiptItem ? receiptItem.Value : null;

    // 4. Resolve ROSCA cycle (use pre-stored cycle_id from transaction, or re-resolve)
    let cycleId = transaction.cycle_id || null;
    if (!cycleId) {
      const chamaRes = await client.query('SELECT chama_type FROM chamas WHERE chama_id = $1', [transaction.chama_id]);
      if (chamaRes.rows[0]?.chama_type === 'ROSCA') {
        const cycleRes = await client.query(
          `SELECT cycle_id FROM rosca_cycles 
           WHERE chama_id = $1 AND status IN ('ACTIVE', 'PENDING') 
           ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END, created_at DESC LIMIT 1`,
          [transaction.chama_id]
        );
        if (cycleRes.rows.length > 0) cycleId = cycleRes.rows[0].cycle_id;
      }
    }

    // 5. Create Contribution Record
    const contribRes = await client.query(
      `INSERT INTO contributions 
      (chama_id, user_id, amount, payment_method, receipt_number, verification_status, status, contribution_date, notes, cycle_id)
      VALUES ($1, $2, $3, 'MPESA', $4, 'VERIFIED', 'COMPLETED', CURRENT_DATE, 'Automated M-Pesa Payment', $5)
      RETURNING contribution_id`,
      [
        transaction.chama_id,
        transaction.user_id,
        parseFloat(amount),
        receipt,
        cycleId
      ]
    );

    const contributionId = contribRes.rows[0].contribution_id;

    // 5. Update Transaction status
    await client.query(
      `UPDATE mpesa_transactions 
      SET status = 'COMPLETED', result_code = 0, mpesa_receipt_number = $1
      WHERE checkout_request_id = $2`,
      [receipt, CheckoutRequestID]
    );

    // 6. Update Chama Fund
    await client.query(
       "UPDATE chamas SET current_fund = current_fund + $1 WHERE chama_id = $2",
       [parseFloat(amount), transaction.chama_id]
    );

    // 7. Update member balance + trigger Trust Score
    await client.query(
      'UPDATE chama_members SET total_contributions = total_contributions + $1, last_contribution_date = NOW(), updated_at = NOW() WHERE chama_id = $2 AND user_id = $3',
      [amount, transaction.chama_id, transaction.user_id]
    );

    // Async trust score update (non-blocking)
    TrustScoreService.updateMemberTrustScore(transaction.chama_id, transaction.user_id).catch(err =>
      logger.error('Trust score update failed', { error: err.message })
    );

    await client.query("COMMIT");

    // 8. Notify user via socket
    getIo().to(`chama_${transaction.chama_id}`).emit("contribution_recorded", {
      chamaId: transaction.chama_id,
      userId: transaction.user_id,
      amount: amount
    });

    res.status(200).send("Success");
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Error processing M-Pesa callback", { error: error.message, stack: error.stack });
    res.status(500).send("Internal Server Error");
  } finally {
    client.release();
  }
};

module.exports = {
  initiatePayment,
  handleCallback
};
