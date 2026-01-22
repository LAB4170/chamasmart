/**
 * Production-Grade Contribution Controller
 * Fixes: Race conditions, idempotency, duplicate detection, money precision
 */

const pool = require("../config/db");
const redis = require("../config/redis");
const { isValidAmount, isValidPaymentMethod } = require("../utils/validators");
const logger = require("../utils/logger");
const { getIo } = require("../socket");
const crypto = require("crypto");

// MONEY HANDLING (Integer Cents)

/**
 * Convert dollars/KES to cents (integer arithmetic)
 * @param {number|string} amount - Amount in dollars
 * @returns {number} Amount in cents
 */
function toCents(amount) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return Math.round(num * 100);
}

/**
 * Convert cents to dollars/KES
 * @param {number} cents - Amount in cents
 * @returns {number} Amount in dollars
 */
function fromCents(cents) {
  return cents / 100;
}

// IDEMPOTENCY SERVICE

class IdempotencyService {
  /**
   * Generate idempotency key from request
   * @param {object} req - Express request object
   * @returns {string} Idempotency key
   */
  static generateKey(req) {
    // Client should send this in header, but we can generate one
    return req.headers["idempotency-key"] || crypto.randomUUID();
  }

  /**
   * Check if request with this key already exists
   * @param {string} key - Idempotency key
   * @returns {Promise<object|null>} Cached response or null
   */
  static async check(key) {
    try {
      const cached = await redis.get(`idempotency:${key}`);
      if (cached) {
        logger.logInfo("Idempotent request detected", { key });
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.logError(error, { context: "IdempotencyService.check", key });
      return null;
    }
  }

  /**
   * Store response for idempotency
   * @param {string} key - Idempotency key
   * @param {object} response - Response to cache
   * @param {number} ttl - Time to live in seconds (default 24 hours)
   */
  static async store(key, response, ttl = 24 * 60 * 60) {
    try {
      await redis.setex(`idempotency:${key}`, ttl, JSON.stringify(response));
    } catch (error) {
      logger.logError(error, { context: "IdempotencyService.store", key });
    }
  }
}

// DUPLICATE DETECTION SERVICE

class DuplicateDetector {
  /**
   * Create fingerprint of a contribution
   * @param {object} params - Contribution parameters
   * @returns {string} Fingerprint hash
   */
  static createFingerprint({
    chamaId,
    userId,
    amount,
    paymentMethod,
    timestamp,
  }) {
    const data = `${chamaId}:${userId}:${amount}:${paymentMethod}:${timestamp}`;
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Check if contribution is a duplicate within time window
   * @param {object} params - Contribution parameters
   * @param {number} windowSeconds - Time window in seconds (default 5 minutes)
   * @returns {Promise<boolean>} True if duplicate detected
   */
  static async isDuplicate(params, windowSeconds = 5 * 60) {
    // Round timestamp to nearest minute to catch near-duplicates
    const roundedTimestamp = Math.floor(Date.now() / (60 * 1000)) * 60 * 1000;

    const fingerprint = this.createFingerprint({
      ...params,
      timestamp: roundedTimestamp,
    });

    const key = `duplicate:contribution:${fingerprint}`;

    try {
      const exists = await redis.get(key);

      if (exists) {
        logger.logSecurityEvent("Duplicate contribution detected", {
          fingerprint,
          params,
        });
        return true;
      }

      // Mark as processed
      await redis.setex(key, windowSeconds, "processed");
      return false;
    } catch (error) {
      logger.logError(error, { context: "DuplicateDetector.isDuplicate" });
      // Fail open - don't block legitimate transactions if Redis is down
      return false;
    }
  }
}

// DATABASE LOCKING STRATEGIES

class DatabaseLock {
  /**
   * Acquire row-level lock on chama for fund updates
   * Prevents race conditions when multiple contributions happen simultaneously
   */
  static async lockChamaForUpdate(client, chamaId) {
    const result = await client.query(
      `SELECT chama_id, current_fund 
       FROM chamas 
       WHERE chama_id = $1 
       FOR UPDATE`, // <-- This is the critical lock
      [chamaId],
    );

    if (result.rows.length === 0) {
      throw new Error("Chama not found");
    }

    return result.rows[0];
  }

  /**
   * Acquire lock on member for contribution update
   */
  static async lockMemberForUpdate(client, chamaId, userId) {
    const result = await client.query(
      `SELECT user_id, total_contributions 
       FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND is_active = true
       FOR UPDATE`,
      [chamaId, userId],
    );

    if (result.rows.length === 0) {
      throw new Error("Member not found or inactive");
    }

    return result.rows[0];
  }

  /**
   * Use advisory lock for distributed locking
   * Useful when you need to lock across multiple tables
   */
  static async acquireAdvisoryLock(client, lockId) {
    // lockId should be a unique integer (e.g., hash of chamaId)
    const result = await client.query(
      "SELECT pg_try_advisory_xact_lock($1) AS acquired",
      [lockId],
    );

    return result.rows[0].acquired;
  }
}

// REFACTORED CONTRIBUTION RECORDING

const recordContribution = async (req, res) => {
  const client = await pool.connect();
  let idempotencyKey;

  try {
    // === IDEMPOTENCY CHECK ===
    idempotencyKey = IdempotencyService.generateKey(req);
    const cachedResponse = await IdempotencyService.check(idempotencyKey);

    if (cachedResponse) {
      logger.logInfo("Returning cached idempotent response", {
        idempotencyKey,
      });
      return res.status(cachedResponse.status).json(cachedResponse.body);
    }

    const { chamaId } = req.params;
    const {
      userId,
      amount,
      paymentMethod,
      receiptNumber,
      notes,
      contributionDate,
    } = req.body;

    // === VALIDATION ===
    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        message: "User ID and amount are required",
      });
    }

    if (!isValidAmount(amount)) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number",
      });
    }

    if (paymentMethod && !isValidPaymentMethod(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    // === CONVERT TO CENTS (Integer Arithmetic) ===
    const amountCents = toCents(amount);

    // === DUPLICATE DETECTION ===
    const isDuplicate = await DuplicateDetector.isDuplicate({
      chamaId,
      userId,
      amount: amountCents,
      paymentMethod: paymentMethod || "CASH",
    });

    if (isDuplicate) {
      logger.logSecurityEvent("Blocked duplicate contribution", {
        chamaId,
        userId,
        amount,
        idempotencyKey,
      });

      return res.status(409).json({
        success: false,
        message:
          "This contribution appears to be a duplicate. If this is a legitimate transaction, please wait 5 minutes and try again.",
        code: "DUPLICATE_DETECTED",
      });
    }

    // === BEGIN TRANSACTION WITH SERIALIZABLE ISOLATION ===
    // SERIALIZABLE is the strictest isolation level
    // Prevents phantom reads and ensures true serializability
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    try {
      // === ACQUIRE LOCKS (Prevents race conditions) ===
      const chama = await DatabaseLock.lockChamaForUpdate(client, chamaId);
      const member = await DatabaseLock.lockMemberForUpdate(
        client,
        chamaId,
        userId,
      );

      // === RECORD CONTRIBUTION ===
      const contributionResult = await client.query(
        `INSERT INTO contributions 
         (chama_id, user_id, amount_cents, payment_method, receipt_number, 
          recorded_by, notes, contribution_date, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING contribution_id, amount_cents, payment_method, contribution_date, created_at`,
        [
          chamaId,
          userId,
          amountCents,
          paymentMethod || "CASH",
          receiptNumber,
          req.user.user_id,
          notes,
          contributionDate || new Date(),
          idempotencyKey,
        ],
      );

      const contribution = contributionResult.rows[0];

      // === UPDATE CHAMA FUND (Using integer arithmetic) ===
      const updateChamaResult = await client.query(
        `UPDATE chamas 
         SET current_fund_cents = current_fund_cents + $1,
             updated_at = NOW()
         WHERE chama_id = $2
         RETURNING current_fund_cents`,
        [amountCents, chamaId],
      );

      const newChamaBalance = updateChamaResult.rows[0].current_fund_cents;

      // === UPDATE MEMBER CONTRIBUTIONS ===
      const updateMemberResult = await client.query(
        `UPDATE chama_members 
         SET total_contributions_cents = total_contributions_cents + $1,
             updated_at = NOW()
         WHERE chama_id = $2 AND user_id = $3
         RETURNING total_contributions_cents`,
        [amountCents, chamaId, userId],
      );

      const newMemberBalance =
        updateMemberResult.rows[0].total_contributions_cents;

      // === CREATE AUDIT TRAIL ===
      await client.query(
        `INSERT INTO audit_log 
         (entity_type, entity_id, action, actor_id, metadata, ip_address)
         VALUES ('contribution', $1, 'CREATE', $2, $3, $4)`,
        [
          contribution.contribution_id,
          req.user.user_id,
          JSON.stringify({
            chamaId,
            userId,
            amount: fromCents(amountCents),
            amountCents,
            paymentMethod: paymentMethod || "CASH",
            receiptNumber,
          }),
          req.ip,
        ],
      );

      // === COMMIT TRANSACTION ===
      await client.query("COMMIT");

      // === PREPARE RESPONSE ===
      const responseData = {
        contribution: {
          ...contribution,
          amount: fromCents(contribution.amount_cents), // Convert back to dollars for API
        },
        balances: {
          chamaBalance: fromCents(newChamaBalance),
          memberBalance: fromCents(newMemberBalance),
        },
      };

      const response = {
        status: 201,
        body: {
          success: true,
          message: "Contribution recorded successfully",
          data: responseData,
        },
      };

      // === STORE IDEMPOTENCY RESPONSE ===
      await IdempotencyService.store(idempotencyKey, response);

      // === EMIT REAL-TIME EVENT (Non-blocking) ===
      setImmediate(() => {
        try {
          const io = getIo();
          io.to(`chama_${chamaId}`).emit("contribution_recorded", {
            chamaId,
            contribution: responseData.contribution,
            balances: responseData.balances,
          });
        } catch (err) {
          logger.logError(err, { context: "WebSocket emission failed" });
        }
      });

      // === AUDIT LOG ===
      logger.logSecurityEvent("Contribution recorded", {
        contributionId: contribution.contribution_id,
        chamaId,
        userId,
        amount: fromCents(amountCents),
        recordedBy: req.user.user_id,
        idempotencyKey,
      });

      return res.status(201).json(response.body);
    } catch (dbError) {
      await client.query("ROLLBACK");

      // Check if it's a serialization error (concurrent transaction conflict)
      if (dbError.code === "40001") {
        logger.logWarning("Serialization error - retrying recommended", {
          chamaId,
          userId,
          error: dbError.message,
        });

        return res.status(409).json({
          success: false,
          message:
            "A concurrent transaction was detected. Please retry your request.",
          code: "SERIALIZATION_ERROR",
          retryable: true,
        });
      }

      throw dbError;
    }
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
    }

    logger.logError(error, {
      context: "recordContribution",
      chamaId: req.params.chamaId,
      userId: req.body.userId,
    });

    return res.status(500).json({
      success: false,
      message: "Error recording contribution",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

// ============================================================================
// SAFE DELETION WITH COMPENSATION
// ============================================================================

const deleteContribution = async (req, res) => {
  const client = await pool.connect();

  try {
    const { chamaId, id } = req.params;
    const idempotencyKey = IdempotencyService.generateKey(req);

    // Check idempotency
    const cachedResponse = await IdempotencyService.check(idempotencyKey);
    if (cachedResponse) {
      return res.status(cachedResponse.status).json(cachedResponse.body);
    }

    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    // === GET AND LOCK CONTRIBUTION ===
    const contributionResult = await client.query(
      `SELECT user_id, amount_cents, is_deleted 
       FROM contributions 
       WHERE chama_id = $1 AND contribution_id = $2
       FOR UPDATE`,
      [chamaId, id],
    );

    if (contributionResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Contribution not found",
      });
    }

    const contribution = contributionResult.rows[0];

    if (contribution.is_deleted) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Contribution already deleted",
      });
    }

    // === LOCK CHAMA AND MEMBER ===
    await DatabaseLock.lockChamaForUpdate(client, chamaId);
    await DatabaseLock.lockMemberForUpdate(
      client,
      chamaId,
      contribution.user_id,
    );

    // === SOFT DELETE ===
    await client.query(
      `UPDATE contributions 
       SET is_deleted = true, 
           deleted_at = NOW(),
           deleted_by = $1,
           idempotency_key = $2
       WHERE contribution_id = $3`,
      [req.user.user_id, idempotencyKey, id],
    );

    // === COMPENSATE BALANCES (SUBTRACT) ===
    await client.query(
      `UPDATE chamas 
       SET current_fund_cents = current_fund_cents - $1,
           updated_at = NOW()
       WHERE chama_id = $2`,
      [contribution.amount_cents, chamaId],
    );

    await client.query(
      `UPDATE chama_members 
       SET total_contributions_cents = total_contributions_cents - $1,
           updated_at = NOW()
       WHERE chama_id = $2 AND user_id = $3`,
      [contribution.amount_cents, chamaId, contribution.user_id],
    );

    // === AUDIT LOG ===
    await client.query(
      `INSERT INTO audit_log 
       (entity_type, entity_id, action, actor_id, metadata, ip_address)
       VALUES ('contribution', $1, 'DELETE', $2, $3, $4)`,
      [
        id,
        req.user.user_id,
        JSON.stringify({
          chamaId,
          userId: contribution.user_id,
          amount: fromCents(contribution.amount_cents),
          reason: req.body.reason,
        }),
        req.ip,
      ],
    );

    await client.query("COMMIT");

    const response = {
      status: 200,
      body: {
        success: true,
        message: "Contribution deleted successfully",
      },
    };

    await IdempotencyService.store(idempotencyKey, response);

    // Emit WebSocket event
    setImmediate(() => {
      try {
        const io = getIo();
        io.to(`chama_${chamaId}`).emit("contribution_deleted", {
          chamaId,
          contributionId: id,
        });
      } catch (err) {
        logger.logError(err, { context: "WebSocket emission failed" });
      }
    });

    logger.logSecurityEvent("Contribution deleted", {
      contributionId: id,
      chamaId,
      deletedBy: req.user.user_id,
    });

    return res.status(200).json(response.body);
  } catch (error) {
    await client.query("ROLLBACK");
    logger.logError(error, { context: "deleteContribution" });

    return res.status(500).json({
      success: false,
      message: "Error deleting contribution",
    });
  } finally {
    client.release();
  }
};

// ============================================================================
// MIGRATION HELPER: Convert Existing Data to Cents
// ============================================================================

const migrateToIntegerCents = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Add new columns if they don't exist
    await client.query(`
      ALTER TABLE contributions 
      ADD COLUMN IF NOT EXISTS amount_cents INTEGER;
      
      ALTER TABLE chamas 
      ADD COLUMN IF NOT EXISTS current_fund_cents INTEGER;
      
      ALTER TABLE chama_members 
      ADD COLUMN IF NOT EXISTS total_contributions_cents INTEGER;
    `);

    // Migrate contributions
    await client.query(`
      UPDATE contributions 
      SET amount_cents = ROUND(amount * 100)
      WHERE amount_cents IS NULL;
    `);

    // Migrate chamas
    await client.query(`
      UPDATE chamas 
      SET current_fund_cents = ROUND(current_fund * 100)
      WHERE current_fund_cents IS NULL;
    `);

    // Migrate members
    await client.query(`
      UPDATE chama_members 
      SET total_contributions_cents = ROUND(total_contributions * 100)
      WHERE total_contributions_cents IS NULL;
    `);

    await client.query("COMMIT");

    console.log("✅ Successfully migrated to integer cents");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    client.release();
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  recordContribution,
  deleteContribution,
  // Export utilities
  IdempotencyService,
  DuplicateDetector,
  DatabaseLock,
  toCents,
  fromCents,
  migrateToIntegerCents,
};
