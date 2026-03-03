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
  const { chamaId } = req.body;
  const { amount, phoneNumber, notes } = req.body;
  const userId = req.user.user_id;

  try {
    // 1. Initiate STK Push via Service
    const mpesaRes = await mpesaService.initiateStkPush(
      phoneNumber,
      amount,
      `CHAMA${chamaId}`,
      "Contribution"
    );

    // 2. Log request in mpesa_transactions
    await pool.query(
      `INSERT INTO mpesa_transactions 
      (checkout_request_id, merchant_request_id, user_id, chama_id, amount, phone_number, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')`,
      [
        mpesaRes.CheckoutRequestID,
        mpesaRes.MerchantRequestID,
        userId,
        chamaId,
        amount,
        phoneNumber
      ]
    );

    res.status(200).json({
      success: true,
      message: "STK Push initiated. Please check your phone.",
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
        "UPDATE mpesa_transactions SET status = 'FAILED', result_code = $1, result_desc = $2 WHERE checkout_request_id = $3",
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

    // 4. Create Contribution Record
    const contribRes = await client.query(
      `INSERT INTO contributions 
      (chama_id, user_id, amount, payment_method, receipt_number, verification_status, contribution_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7)
      RETURNING contribution_id`,
      [
        transaction.chama_id,
        transaction.user_id,
        Money.toCents(amount),
        'MPESA',
        receipt,
        'VERIFIED',
        'Automated M-Pesa Payment'
      ]
    );

    const contributionId = contribRes.rows[0].contribution_id;

    // 5. Update Transaction status
    await client.query(
      `UPDATE mpesa_transactions 
      SET status = 'COMPLETED', result_code = 0, mpesa_receipt = $1, contribution_id = $2
      WHERE checkout_request_id = $3`,
      [receipt, contributionId, CheckoutRequestID]
    );

    // 6. Update Chama Fund
    await client.query(
       "UPDATE chamas SET current_fund = current_fund + $1 WHERE chama_id = $2",
       [Money.toCents(amount), transaction.chama_id]
    );

    // 7. Update Member trust score
    await TrustScoreService.updateScore(transaction.user_id, 'payment_verified');

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
