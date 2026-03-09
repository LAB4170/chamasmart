const pool = require("../config/db");
const mpesaService = require("../utils/mpesaService");
const logger = require("../utils/logger");
const { getIo } = require("../socket");
const { AppError } = require("../middleware/errorHandler");
const TrustScoreService = require("../utils/trustScoreService");
const Money = require("../utils/money");

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
    } else if (chamaType === 'ASCA') {
      const cycleRes = await pool.query(
        `SELECT cycle_id FROM asca_cycles 
         WHERE chama_id = $1 AND status IN ('ACTIVE', 'PENDING') 
         ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END, created_at DESC 
         LIMIT 1`,
        [chamaId]
      );
      if (cycleRes.rows.length > 0) cycleId = cycleRes.rows[0].cycle_id;
    }

    logger.info("Initiating M-Pesa STK Push", { chamaId, amount, phoneNumber, userId });

    // 2. Initiate STK Push via Daraja
    const mpesaRes = await mpesaService.initiateStkPush(
      phoneNumber,
      amount,
      `CHAMA${chamaId}`,
      'Contribution'
    );

    logger.info("M-Pesa STK Push Initiated Success", { checkoutRequestId: mpesaRes.CheckoutRequestID });

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

    // In mock mode, auto-fire callback after response is sent to complete the full ledger cycle
    if (mpesaRes.isMock) {
      setImmediate(async () => {
        try {
          const fakePayload = await mpesaService.simulateMockCallback(
            mpesaRes.CheckoutRequestID, amount, phoneNumber
          );
          const mockReq = { body: fakePayload };
          const mockRes = {
            status: (s) => ({ send: (m) => logger.info('Mock callback response', { status: s, msg: m }) })
          };
          await handleCallback(mockReq, mockRes);
          logger.info('M-Pesa Mock: Auto-callback completed — DB updated');
        } catch (err) {
          logger.error('M-Pesa Mock: Auto-callback failed', { error: err.message });
        }
      });
    }
  } catch (error) {
    logger.error("M-Pesa Initiation Error", { 
      message: error.message, 
      stack: error.stack,
      data: error.response?.data,
      code: error.code
    });

    // Handle network/timeout errors specifically
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.message.toLowerCase().includes('timeout')) {
      return next(new AppError('M-Pesa service is currently taking too long to respond. Please try again.', 504));
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return next(new AppError('M-Pesa service is currently unreachable. Please try again later.', 503));
    }

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

  // Step helper: tags errors with their origin for structured logging
  const step = (label, fn) => fn().catch(e => { e._step = label; throw e; });

  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    // 1. Find transaction
    const txRes = await step('find_transaction', () =>
      client.query(
        "SELECT * FROM mpesa_transactions WHERE checkout_request_id = $1 FOR UPDATE",
        [CheckoutRequestID]
      )
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

    // 4. Resolve Chama Context & Cycle
    const chamaRes = await client.query('SELECT chama_type, share_price FROM chamas WHERE chama_id = $1', [transaction.chama_id]);
    const chamaType = chamaRes.rows[0]?.chama_type;
    const chamaSharePrice = parseFloat(chamaRes.rows[0]?.share_price || 0);

    let cycleId = transaction.cycle_id || null;
    let cycleSharePrice = 0;

    if (!cycleId) {
      if (chamaType === 'ROSCA') {
        const cycleRes = await client.query(
          `SELECT cycle_id FROM rosca_cycles 
           WHERE chama_id = $1 AND status IN ('ACTIVE', 'PENDING') 
           ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END, created_at DESC LIMIT 1`,
          [transaction.chama_id]
        );
        if (cycleRes.rows.length > 0) {
          cycleId = cycleRes.rows[0].cycle_id;
        }
      } else if (chamaType === 'ASCA') {
        const cycleRes = await client.query(
          `SELECT cycle_id, share_price FROM asca_cycles 
           WHERE chama_id = $1 AND status IN ('ACTIVE', 'PENDING') 
           ORDER BY CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END, created_at DESC LIMIT 1`,
          [transaction.chama_id]
        );
        if (cycleRes.rows.length > 0) {
          cycleId = cycleRes.rows[0].cycle_id;
          cycleSharePrice = parseFloat(cycleRes.rows[0].share_price || 0);
        }
      }
    } else {
      // If cycleId was pre-stored, fetch its share price if ASCA
      if (chamaType === 'ASCA') {
        const cycleInfo = await client.query('SELECT share_price FROM asca_cycles WHERE cycle_id = $1', [cycleId]);
        cycleSharePrice = parseFloat(cycleInfo.rows[0]?.share_price || 0);
      }
    }

    // 5. Create Contribution Record (Generic Ledger)
    const contribRes = await step('insert_contribution', () =>
      client.query(
        `INSERT INTO contributions 
        (chama_id, user_id, amount, payment_method, receipt_number, verification_status, status, contribution_date, notes, cycle_id, contribution_type)
        VALUES ($1, $2, $3, 'MPESA', $4, 'VERIFIED', 'COMPLETED', CURRENT_DATE, 'Automated M-Pesa Payment', $5, $6)
        RETURNING contribution_id`,
        [
          transaction.chama_id,
          transaction.user_id,
          parseFloat(amount),
          receipt,
          cycleId,
          chamaType === 'ASCA' ? 'ASCA_SHARE' : 'CONTRIBUTION'
        ]
      )
    );

    // 6. ASCA Specific Logic: Record Shares & Update Equity
    if (chamaType === 'ASCA' && cycleId) {
      const basePrice = cycleSharePrice || chamaSharePrice;
      if (basePrice > 0) {
        const sharesBought = parseFloat(amount) / basePrice;
        
        // Record in ASCA share ledger
        await step('insert_asca_shares', () =>
          client.query(
            `INSERT INTO asca_share_contributions (user_id, chama_id, cycle_id, amount, number_of_shares)
             VALUES ($1, $2, $3, $4, $5)`,
            [transaction.user_id, transaction.chama_id, cycleId, amount, sharesBought]
          )
        );

        // Update asca_members membership
        await step('upsert_asca_members', () =>
          client.query(
            `INSERT INTO asca_members (user_id, cycle_id, shares_owned, total_investment, status)
             VALUES ($1, $2, $3, $4, 'ACTIVE')
             ON CONFLICT (user_id, cycle_id) 
             DO UPDATE SET 
               shares_owned = asca_members.shares_owned + EXCLUDED.shares_owned,
               total_investment = asca_members.total_investment + EXCLUDED.total_investment`,
            [transaction.user_id, cycleId, sharesBought, amount]
          )
        );
      } else {
        logger.warn("ASCA payment received but no share price found", { chamaId: transaction.chama_id });
      }
    }

    // 7. Update Transaction status
    await step('update_mpesa_tx', () =>
      client.query(
        `UPDATE mpesa_transactions 
        SET status = 'COMPLETED', result_code = 0, mpesa_receipt_number = $1
        WHERE checkout_request_id = $2`,
        [receipt, CheckoutRequestID]
      )
    );

    // 8. Update Chama Fund & Member Stats
    await step('update_chama_fund', () =>
      client.query(
         "UPDATE chamas SET current_fund = current_fund + $1 WHERE chama_id = $2",
         [parseFloat(amount), transaction.chama_id]
      )
    );

    await step('update_member_stats', () =>
      client.query(
        'UPDATE chama_members SET total_contributions = total_contributions + $1, last_contribution_date = NOW(), updated_at = NOW() WHERE chama_id = $2 AND user_id = $3',
        [amount, transaction.chama_id, transaction.user_id]
      )
    );

    await client.query("COMMIT");

    // Update trust score after successful commit to reflect the new contribution
    try {
      await TrustScoreService.updateMemberTrustScore(transaction.chama_id, transaction.user_id);
    } catch (err) {
      logger.error('Trust score update failed', { error: err.message });
    }

    // 8. Notify user via socket
    getIo().to(`chama_${transaction.chama_id}`).emit("contribution_recorded", {
      chamaId: transaction.chama_id,
      userId: transaction.user_id,
      amount: amount
    });

    res.status(200).send("Success");
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    logger.error("M-Pesa callback processing FAILED", {
      checkoutRequestId: CheckoutRequestID,
      step: error._step || 'unknown',
      error: error.message,
      stack: error.stack
    });
    // Safaricom API contract: MUST return 200 — non-200 triggers automatic retries
    // which can cause duplicate contribution processing
    res.status(200).send("Acknowledged");
  } finally {
    client.release();
  }
};

module.exports = {
  initiatePayment,
  handleCallback
};
