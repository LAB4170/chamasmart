/**
 * Production-Grade Contribution Controller
 * Fixes: Authorization, validation, error handling, money precision
 */

const crypto = require("crypto");
const pool = require("../config/db");
const { redis } = require("../config/redis");
const logger = require("../utils/logger");
const { getIo } = require("../socket");
const { AppError } = require("../middleware/errorHandler");
const { body, validationResult } = require("express-validator");

// ============================================================================
// MONEY HANDLING (Integer Cents)
// ============================================================================

class Money {
  static toCents(amount) {
    if (typeof amount === "string") {
      amount = parseFloat(amount);
    }
    if (isNaN(amount) || amount < 0) {
      throw new AppError("Invalid amount", 400, "INVALID_AMOUNT");
    }
    return Math.round(amount * 100);
  }

  static fromCents(cents) {
    return parseFloat((cents / 100).toFixed(2));
  }

  static add(a, b) {
    return a + b;
  }

  static subtract(a, b) {
    const result = a - b;
    if (result < 0) {
      throw new AppError("Insufficient funds", 400, "INSUFFICIENT_FUNDS");
    }
    return result;
  }
}

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

const contributionValidation = [
  body("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isInt({ min: 1 })
    .withMessage("Invalid user ID"),
  body("amount")
    .notEmpty()
    .withMessage("Amount is required")
    .isFloat({ min: 0.01, max: 10000000 })
    .withMessage("Amount must be between 0.01 and 10,000,000")
    .toFloat(),
  body("paymentMethod")
    .optional()
    .isIn(["CASH", "MPESA", "BANK_TRANSFER", "CHEQUE"])
    .withMessage("Invalid payment method")
    .toUpperCase(),
  body("receiptNumber")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Receipt number too long")
    .escape(),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes too long")
    .escape(),
  body("contributionDate")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format")
    .toDate(),
];

// ============================================================================
// AUTHORIZATION HELPER
// ============================================================================

async function checkChamaAuthorization(
  client,
  chamaId,
  userId,
  requiredRoles = ["TREASURER", "CHAIRPERSON", "SECRETARY"],
) {
  const result = await client.query(
    `SELECT role FROM chama_members 
     WHERE chama_id = $1 AND user_id = $2 AND is_active = true`,
    [chamaId, userId],
  );

  if (result.rows.length === 0) {
    throw new AppError("Not a member of this chama", 403, "NOT_CHAMA_MEMBER");
  }

  if (!requiredRoles.includes(result.rows[0].role)) {
    throw new AppError(
      `Insufficient permissions. Required roles: ${requiredRoles.join(", ")}`,
      403,
      "INSUFFICIENT_PERMISSIONS",
    );
  }

  return result.rows[0].role;
}

// ============================================================================
// IDEMPOTENCY SERVICE
// ============================================================================

class IdempotencyService {
  static generateKey(req) {
    return req.headers["idempotency-key"] || crypto.randomUUID();
  }

  static async check(key) {
    try {
      const cached = await redis.get(`idempotency:${key}`);
      if (cached) {
        logger.info("Idempotent request detected", { key });
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.error("Idempotency check failed", { error: error.message, key });
      return null;
    }
  }

  static async store(key, response, ttl = 24 * 60 * 60) {
    try {
      await redis.setex(`idempotency:${key}`, ttl, JSON.stringify(response));
    } catch (error) {
      logger.error("Idempotency store failed", { error: error.message, key });
    }
  }
}

// ============================================================================
// DUPLICATE DETECTION SERVICE
// ============================================================================

class DuplicateDetector {
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

  static async isDuplicate(params, windowSeconds = 5 * 60) {
    const roundedTimestamp = Math.floor(Date.now() / (60 * 1000)) * 60 * 1000;
    const fingerprint = this.createFingerprint({
      ...params,
      timestamp: roundedTimestamp,
    });

    const key = `duplicate:contribution:${fingerprint}`;

    try {
      const exists = await redis.get(key);
      if (exists) {
        logger.warn("Duplicate contribution detected", { fingerprint, params });
        return true;
      }

      await redis.setex(key, windowSeconds, "processed");
      return false;
    } catch (error) {
      logger.error("Duplicate detection failed", { error: error.message });
      return false; // Fail open
    }
  }
}

// ============================================================================
// RECORD CONTRIBUTION
// ============================================================================

const recordContribution = async (req, res, next) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  const client = await pool.connect();
  let idempotencyKey;

  try {
    // Check idempotency
    idempotencyKey = IdempotencyService.generateKey(req);
    const cachedResponse = await IdempotencyService.check(idempotencyKey);

    if (cachedResponse) {
      return res.status(cachedResponse.status).json(cachedResponse.body);
    }

    const { chamaId } = req.params;
    const {
      userId,
      amount,
      paymentMethod = "CASH",
      receiptNumber,
      notes,
      contributionDate,
    } = req.body;

    // Check authorization
    await checkChamaAuthorization(client, chamaId, req.user.user_id, [
      "TREASURER",
      "CHAIRPERSON",
      "SECRETARY",
    ]);

    // Convert to cents
    const amountCents = Money.toCents(amount);

    // Duplicate detection
    const isDuplicate = await DuplicateDetector.isDuplicate({
      chamaId,
      userId,
      amount: amountCents,
      paymentMethod,
    });

    if (isDuplicate) {
      throw new AppError(
        "This contribution appears to be a duplicate. If this is a legitimate transaction, please wait 5 minutes and try again.",
        409,
        "DUPLICATE_DETECTED",
      );
    }

    // Begin transaction
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    try {
      // Verify chama exists and is active
      const chamaResult = await client.query(
        "SELECT chama_id, is_active FROM chamas WHERE chama_id = $1 FOR UPDATE",
        [chamaId],
      );

      if (chamaResult.rows.length === 0) {
        throw new AppError("Chama not found", 404, "CHAMA_NOT_FOUND");
      }

      if (!chamaResult.rows[0].is_active) {
        throw new AppError("Chama is not active", 400, "CHAMA_INACTIVE");
      }

      // Verify member exists and is active
      const memberResult = await client.query(
        `SELECT user_id, total_contributions, is_active 
         FROM chama_members 
         WHERE chama_id = $1 AND user_id = $2 
         FOR UPDATE`,
        [chamaId, userId],
      );

      if (memberResult.rows.length === 0) {
        throw new AppError(
          "User is not a member of this chama",
          400,
          "NOT_MEMBER",
        );
      }

      if (!memberResult.rows[0].is_active) {
        throw new AppError("Member is not active", 400, "MEMBER_INACTIVE");
      }

      // Record contribution
      const contributionResult = await client.query(
        `INSERT INTO contributions 
         (chama_id, user_id, amount, payment_method, receipt_number, 
          recorded_by, notes, contribution_date, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING contribution_id, chama_id, user_id, amount, 
                   payment_method, receipt_number, contribution_date, created_at`,
        [
          chamaId,
          userId,
          amount,
          paymentMethod,
          receiptNumber || null,
          req.user.user_id,
          notes || null,
          contributionDate || new Date(),
          idempotencyKey,
        ],
      );

      const contribution = contributionResult.rows[0];

      // Update chama fund
      const updateChamaResult = await client.query(
        `UPDATE chamas 
         SET current_fund = COALESCE(current_fund, 0) + $1,
             updated_at = NOW()
         WHERE chama_id = $2
         RETURNING current_fund`,
        [amount, chamaId],
      );

      const newChamaBalance = updateChamaResult.rows[0].current_fund;

      // Update member contributions
      const updateMemberResult = await client.query(
        `UPDATE chama_members 
         SET total_contributions = COALESCE(total_contributions, 0) + $1,
             updated_at = NOW()
         WHERE chama_id = $2 AND user_id = $3
         RETURNING total_contributions`,
        [amount, chamaId, userId],
      );

      const newMemberBalance =
        updateMemberResult.rows[0].total_contributions;

      // Commit transaction
      await client.query("COMMIT");

      // Prepare response
      const responseData = {
        contribution: {
          ...contribution,
          amount: parseFloat(contribution.amount),
        },
        balances: {
          chamaBalance: parseFloat(newChamaBalance),
          memberBalance: parseFloat(newMemberBalance),
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

      // Store idempotency response
      await IdempotencyService.store(idempotencyKey, response);

      // Emit real-time event (non-blocking)
      setImmediate(() => {
        try {
          const io = getIo();
          io.to(`chama_${chamaId}`).emit("contribution_recorded", {
            chamaId,
            contribution: responseData.contribution,
            balances: responseData.balances,
          });
        } catch (err) {
          logger.error("WebSocket emission failed", { error: err.message });
        }
      });

      // Log success
      logger.info("Contribution recorded", {
        contributionId: contribution.contribution_id,
        chamaId,
        userId,
        amount: Money.fromCents(amountCents),
        recordedBy: req.user.user_id,
        idempotencyKey,
      });

      return res.status(201).json(response.body);
    } catch (dbError) {
      await client.query("ROLLBACK");

      // Handle serialization errors (concurrent transaction conflict)
      if (dbError.code === "40001") {
        logger.warn("Serialization error - concurrent transaction detected", {
          chamaId,
          userId,
          error: dbError.message,
        });

        throw new AppError(
          "A concurrent transaction was detected. Please retry your request.",
          409,
          "SERIALIZATION_ERROR",
        );
      }

      throw dbError;
    }
  } catch (error) {
    logger.error("Contribution recording failed", {
      error: error.message,
      stack: error.stack,
      chamaId: req.params.chamaId,
      userId: req.body.userId,
    });
    next(error);
  } finally {
    if (client) {
      client.release();
    }
  }
};

// ============================================================================
// GET CONTRIBUTIONS
// ============================================================================

const getContributions = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const { page = 1, limit = 20, userId, startDate, endDate } = req.query;

    // Authorization check
    const authCheck = await pool.query(
      `SELECT 1 FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND is_active = true`,
      [chamaId, req.user.user_id],
    );

    if (authCheck.rows.length === 0) {
      throw new AppError(
        "Not authorized to view contributions",
        403,
        "NOT_AUTHORIZED",
      );
    }

    // Build query
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = `
      SELECT c.contribution_id, c.chama_id, c.user_id, c.amount,
             c.payment_method, c.receipt_number, c.contribution_date, c.created_at,
             u.first_name || ' ' || u.last_name as contributor_name,
             r.first_name || ' ' || r.last_name as recorded_by_name
      FROM contributions c
      JOIN users u ON c.user_id = u.user_id
      LEFT JOIN users r ON c.recorded_by = r.user_id
      WHERE c.chama_id = $1 AND c.is_deleted = false
    `;

    const params = [chamaId];
    let paramIndex = 2;

    if (userId && !isNaN(parseInt(userId))) {
      query += ` AND c.user_id = $${paramIndex}`;
      params.push(parseInt(userId));
      paramIndex++;
    }

    if (startDate) {
      query += ` AND c.contribution_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND c.contribution_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY c.contribution_date DESC, c.created_at DESC
               LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    // Get total count
    let countQuery =
      "SELECT COUNT(*) as total FROM contributions WHERE chama_id = $1 AND is_deleted = false";
    const countParams = [chamaId];
    if (userId && !isNaN(parseInt(userId))) {
      countQuery += " AND user_id = $2";
      countParams.push(parseInt(userId));
    }

    const [result, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, countParams),
    ]);

    const contributions = result.rows.map((row) => ({
      ...row,
      amount: parseFloat(row.amount),
    }));

    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: contributions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// DELETE CONTRIBUTION
// ============================================================================

const deleteContribution = async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { chamaId, id } = req.params;
    const { reason } = req.body;

    // Check authorization
    await checkChamaAuthorization(client, chamaId, req.user.user_id, [
      "TREASURER",
      "CHAIRPERSON",
    ]);

    const idempotencyKey = IdempotencyService.generateKey(req);
    const cachedResponse = await IdempotencyService.check(idempotencyKey);
    if (cachedResponse) {
      return res.status(cachedResponse.status).json(cachedResponse.body);
    }

    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    try {
      // Get and lock contribution
      const contributionResult = await client.query(
        `SELECT user_id, amount, is_deleted 
         FROM contributions 
         WHERE chama_id = $1 AND contribution_id = $2
         FOR UPDATE`,
        [chamaId, id],
      );

      if (contributionResult.rows.length === 0) {
        throw new AppError(
          "Contribution not found",
          404,
          "CONTRIBUTION_NOT_FOUND",
        );
      }

      const contribution = contributionResult.rows[0];

      if (contribution.is_deleted) {
        throw new AppError(
          "Contribution already deleted",
          400,
          "ALREADY_DELETED",
        );
      }

      // Lock chama and member
      await client.query(
        "SELECT chama_id FROM chamas WHERE chama_id = $1 FOR UPDATE",
        [chamaId],
      );

      await client.query(
        "SELECT user_id FROM chama_members WHERE chama_id = $1 AND user_id = $2 FOR UPDATE",
        [chamaId, contribution.user_id],
      );

      // Soft delete contribution
      await client.query(
        `UPDATE contributions 
         SET is_deleted = true, 
             deleted_at = NOW(),
             deleted_by = $1,
             deletion_reason = $2,
             idempotency_key = $3
         WHERE contribution_id = $4`,
        [req.user.user_id, reason, idempotencyKey, id],
      );

      // Compensate balances
      await client.query(
        `UPDATE chamas 
         SET current_fund = current_fund - $1,
             updated_at = NOW()
         WHERE chama_id = $2`,
        [contribution.amount, chamaId],
      );

      await client.query(
        `UPDATE chama_members 
         SET total_contributions = total_contributions - $1,
             updated_at = NOW()
         WHERE chama_id = $2 AND user_id = $3`,
        [contribution.amount, chamaId, contribution.user_id],
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
          logger.error("WebSocket emission failed", { error: err.message });
        }
      });

      logger.info("Contribution deleted", {
        contributionId: id,
        chamaId,
        deletedBy: req.user.user_id,
        reason,
      });

      return res.status(200).json(response.body);
    } catch (dbError) {
      await client.query("ROLLBACK");
      throw dbError;
    }
  } catch (error) {
    next(error);
  } finally {
    if (client) {
      client.release();
    }
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  recordContribution: [contributionValidation, recordContribution],
  getContributions,
  deleteContribution,
  // Export utilities for testing
  Money,
  IdempotencyService,
  DuplicateDetector,
};
