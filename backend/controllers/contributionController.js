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
const TrustScoreService = require("../utils/trustScoreService");
const { clearChamaCache } = require('../utils/cache');
const Money = require('../utils/money');
const ShareSync = require('../utils/shareSync');


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
    .isIn(["CASH", "MPESA", "BANK_TRANSFER", "CHEQUE", "OTHER"])
    .withMessage("Invalid payment method")
    .toUpperCase(),
  body("receiptNumber")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Receipt number too long")
    .escape(),
  body("paymentProof")
    .optional()
    .trim()
    .isLength({ max: 512 })
    .withMessage("Payment proof URL too long"),
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
  body("verificationStatus")
    .optional()
    .isIn(["PENDING", "VERIFIED", "REJECTED"])
    .withMessage("Invalid verification status"),
];

// ============================================================================
// ROSCA CYCLE RESOLUTION HELPER
// ============================================================================

/**
 * Resolves the active ROSCA cycle for a chama if it is a ROSCA type.
 * Returns { cycle_id, contribution_amount, cycle_name } or null.
 */
async function resolveRoscaCycle(client, chamaId) {
  // Get chama type first
  const chamaTypeRes = await client.query(
    'SELECT chama_type FROM chamas WHERE chama_id = $1',
    [chamaId]
  );

  if (chamaTypeRes.rows.length === 0 || chamaTypeRes.rows[0].chama_type !== 'ROSCA') {
    return null; // Not a ROSCA chama — no cycle needed
  }

  // Fetch active cycle
  const cycleRes = await client.query(
    `SELECT cycle_id, cycle_name, contribution_amount 
     FROM rosca_cycles 
     WHERE chama_id = $1 AND status = 'ACTIVE' 
     ORDER BY created_at DESC 
     LIMIT 1`,
    [chamaId]
  );

  if (cycleRes.rows.length === 0) {
    // No active cycle — check for PENDING cycles
    const pendingRes = await client.query(
      `SELECT cycle_id, cycle_name, contribution_amount 
       FROM rosca_cycles 
       WHERE chama_id = $1 AND status = 'PENDING' 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [chamaId]
    );
    if (pendingRes.rows.length > 0) {
      return { ...pendingRes.rows[0], warningNoActive: true };
    }
    return null; // No cycles at all
  }

  return cycleRes.rows[0];
}

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
      paymentProof,
      notes,
      contributionDate,
      verificationStatus = "VERIFIED",
      meetingId,
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

    // Resolve ROSCA cycle (before transaction lock)
    const roscaCycle = await resolveRoscaCycle(client, chamaId);

    // Begin transaction
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    try {
      // Verify chama exists and is active
      const chamaResult = await client.query(
        "SELECT chama_id, is_active, chama_type FROM chamas WHERE chama_id = $1 FOR UPDATE",
        [chamaId],
      );

      if (chamaResult.rows.length === 0) {
        throw new AppError("Chama not found", 404, "CHAMA_NOT_FOUND");
      }

      if (!chamaResult.rows[0].is_active) {
        throw new AppError("Chama is not active", 400, "CHAMA_INACTIVE");
      }

      // For ROSCA chamas, ensure there's an active/pending cycle
      const chamaType = chamaResult.rows[0].chama_type;
      if (chamaType === 'ROSCA' && !roscaCycle) {
        throw new AppError(
          'No active or pending ROSCA cycle found. Please create a cycle before recording contributions.',
          400,
          'NO_ACTIVE_CYCLE'
        );
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

      // Record contribution — populate cycle_id for ROSCA
      const technicalStatus = verificationStatus === 'VERIFIED' ? 'COMPLETED' : 'PENDING';
      const cycleId = roscaCycle?.cycle_id || null;
      const contributionResult = await client.query(
        `INSERT INTO contributions 
         (chama_id, user_id, amount, payment_method, receipt_number, payment_proof, 
          recorded_by, notes, contribution_date, idempotency_key, verification_status, status, cycle_id, meeting_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING contribution_id, chama_id, user_id, amount, cycle_id, meeting_id,
                   payment_method, receipt_number, payment_proof, contribution_date, 
                   verification_status, status, created_at`,
        [
          chamaId,
          userId,
          amount,
          paymentMethod,
          receiptNumber || null,
          paymentProof || null,
          req.user.user_id,
          notes || null,
          contributionDate || new Date(),
          idempotencyKey || null,
          verificationStatus,
          technicalStatus,
          cycleId,
          meetingId || null,
        ],
      );

      const contribution = contributionResult.rows[0];

      // Update Balances if VERIFIED instantly (for cash/official records)
      let newChamaBalance;
      let newMemberBalance;

      if (verificationStatus === 'VERIFIED') {
        const updateChamaResult = await client.query(
          `UPDATE chamas 
           SET current_fund = COALESCE(current_fund, 0) + $1,
               updated_at = NOW()
           WHERE chama_id = $2
           RETURNING current_fund`,
          [amount, chamaId],
        );
        newChamaBalance = updateChamaResult.rows[0].current_fund;

        // NEW: If part of a live meeting session, update meeting total collections
        if (meetingId) {
          await client.query(
            "UPDATE meetings SET total_collections = total_collections + $1 WHERE meeting_id = $2",
            [amount, meetingId]
          );
        }

        const updateMemberResult = await client.query(
          `UPDATE chama_members 
           SET total_contributions = COALESCE(total_contributions, 0) + $1,
               last_contribution_date = NOW(),
               updated_at = NOW()
           WHERE chama_id = $2 AND user_id = $3
           RETURNING total_contributions`,
          [amount, chamaId, userId],
        );
        newMemberBalance = updateMemberResult.rows[0].total_contributions;
      } else {
        // Just fetch current balances for the response if not updating
        const chamaBalRes = await client.query("SELECT current_fund FROM chamas WHERE chama_id = $1", [chamaId]);
        const memberBalRes = await client.query("SELECT total_contributions FROM chama_members WHERE chama_id = $1 AND user_id = $2", [chamaId, userId]);
        newChamaBalance = chamaBalRes.rows[0]?.current_fund || 0;
        newMemberBalance = memberBalRes.rows[0]?.total_contributions || 0;
      }

      // Commit transaction
      await client.query("COMMIT");

      // Invalidate stats cache
      clearChamaCache(chamaId);

      if (verificationStatus === 'VERIFIED') {
        try {
          await TrustScoreService.updateMemberTrustScore(chamaId, userId);
        } catch (err) {
          logger.error('Failed to update trust score', { error: err.message, userId });
        }

        // Auto-actualize shares for ASCA and TABLE_BANKING chamas
        if (['ASCA', 'TABLE_BANKING'].includes(chamaType)) {
          const shareClient = await pool.connect();
          try {
            await shareClient.query('BEGIN');
            await ShareSync.syncContributionToShares(shareClient, contribution.contribution_id);
            await shareClient.query('COMMIT');
          } catch (syncErr) {
            await shareClient.query('ROLLBACK');
            logger.error('Share sync failed (non-fatal)', { error: syncErr.message, contributionId: contribution.contribution_id });
          } finally {
            shareClient.release();
          }
        }
      }

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
          ...(roscaCycle?.warningNoActive ? { warning: 'No ACTIVE cycle found. Contribution linked to PENDING cycle.' } : {}),
        },
      };

      // Store idempotency response
      await IdempotencyService.store(idempotencyKey, response);

      // Emit real-time event (non-blocking)
      setImmediate(() => {
        try {
          if (process.env.NODE_ENV !== 'test') {
            const io = getIo();
            io.to(`chama_${chamaId}`).emit("contribution_recorded", {
              chamaId,
              contribution: responseData.contribution,
              balances: responseData.balances,
            });
          }
        } catch (err) {
          logger.warn("WebSocket emission failed", { error: err.message });
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
// BULK RECORD CONTRIBUTIONS
// ============================================================================

const bulkRecordContributions = async (req, res, next) => {
  const client = await pool.connect();
  let idempotencyKey;

  try {
    idempotencyKey = IdempotencyService.generateKey(req);
    const cachedResponse = await IdempotencyService.check(idempotencyKey);
    if (cachedResponse) {
      return res.status(cachedResponse.status).json(cachedResponse.body);
    }

    const { chamaId } = req.params;
    const { contributions, meetingId } = req.body;

    // Authorization check
    await checkChamaAuthorization(client, chamaId, req.user.user_id, [
      "TREASURER",
      "CHAIRPERSON",
      "SECRETARY",
    ]);

    // Resolve ROSCA cycle before transaction
    const roscaCycle = await resolveRoscaCycle(client, chamaId);

    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");

    const successes = [];
    const verifiedUsers = [];
    const verifiedContributionIds = []; // for share sync
    
    // Verify chama
    const chamaRes = await client.query(
      "SELECT chama_id, is_active, current_fund, chama_type FROM chamas WHERE chama_id = $1 FOR UPDATE",
      [chamaId]
    );

    if (chamaRes.rows.length === 0) {
      throw new AppError("Chama not found", 404, "CHAMA_NOT_FOUND");
    }

    if (!chamaRes.rows[0].is_active) {
      throw new AppError("Chama is not active", 400, "CHAMA_INACTIVE");
    }

    // Guard: ROSCA needs a cycle
    if (chamaRes.rows[0].chama_type === 'ROSCA' && !roscaCycle) {
      throw new AppError(
        'No active or pending ROSCA cycle found. Please create a cycle before bulk recording.',
        400,
        'NO_ACTIVE_CYCLE'
      );
    }

    let currentChamaFund = Money.toCents(chamaRes.rows[0].current_fund || 0);

    for (const entry of contributions) {
      const {
        userId,
        amount,
        paymentMethod = "CASH",
        receiptNumber,
        paymentProof,
        notes,
        contributionDate,
        verificationStatus = "VERIFIED",
      } = entry;

      const amountCents = Money.toCents(amount);

      // Duplicate detection
      const isDuplicate = await DuplicateDetector.isDuplicate({
        chamaId,
        userId,
        amount: amountCents,
        paymentMethod,
      });

      if (isDuplicate) {
        throw new AppError(`Duplicate submission detected for user ${userId}`, 409, "DUPLICATE_DETECTED");
      }

      // Verify member
      const memberRes = await client.query(
        "SELECT user_id, is_active FROM chama_members WHERE chama_id = $1 AND user_id = $2 FOR UPDATE",
        [chamaId, userId]
      );

      if (memberRes.rows.length === 0) {
        throw new AppError(`User ${userId} is not a member`, 400, "NOT_MEMBER");
      }

      if (!memberRes.rows[0].is_active) {
        throw new AppError(`Member ${userId} is not active`, 400, "MEMBER_INACTIVE");
      }

      const technicalStatus = verificationStatus === 'VERIFIED' ? 'COMPLETED' : 'PENDING';

      const cycleId = roscaCycle?.cycle_id || null;
      const contribRes = await client.query(
        `INSERT INTO contributions 
         (chama_id, user_id, amount, payment_method, receipt_number, payment_proof, 
          recorded_by, notes, contribution_date, verification_status, status, cycle_id, meeting_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING contribution_id, amount, cycle_id, meeting_id`,
        [chamaId, userId, amount, paymentMethod, receiptNumber || null, paymentProof || null, 
         req.user.user_id, notes || null, contributionDate || new Date(), verificationStatus, technicalStatus, cycleId, meetingId || null]
      );

      const contributionId = contribRes.rows[0].contribution_id;

      if (verificationStatus === 'VERIFIED') {
        await client.query(
          `UPDATE chama_members SET total_contributions = COALESCE(total_contributions, 0) + $1, 
           last_contribution_date = NOW(), updated_at = NOW() 
           WHERE chama_id = $2 AND user_id = $3`,
          [amount, chamaId, userId]
        );
        currentChamaFund += amountCents;
      }

      successes.push({ contributionId, userId, amount });
      if (verificationStatus === 'VERIFIED') {
        verifiedUsers.push(userId);
        verifiedContributionIds.push(contributionId);
      }
    }

    // Update Chama Fund
    const updatedChamaFund = Money.fromCents(currentChamaFund);
    await client.query(
      "UPDATE chamas SET current_fund = $1, updated_at = NOW() WHERE chama_id = $2",
      [updatedChamaFund, chamaId]
    );

    // NEW: Bulk update meeting totals if session is active
    if (meetingId && verifiedUsers.length > 0) {
      const totalBulkAmount = contributions
        .filter(c => c.verificationStatus === 'VERIFIED' || !c.verificationStatus)
        .reduce((sum, c) => sum + parseFloat(c.amount), 0);

      await client.query(
        "UPDATE meetings SET total_collections = total_collections + $1 WHERE meeting_id = $2",
        [totalBulkAmount, meetingId]
      );
    }

    await client.query("COMMIT");

    // Sync trust score update for all successful users
    for (const verifiedUserId of verifiedUsers) {
      try {
        await TrustScoreService.updateMemberTrustScore(chamaId, verifiedUserId);
      } catch (err) {
        logger.error('Bulk TrustScore Update Error', { error: err.message, userId: verifiedUserId });
      }
    }

    // Auto-actualize shares for ASCA and TABLE_BANKING chamas
    if (['ASCA', 'TABLE_BANKING'].includes(chamaRes.rows[0].chama_type) && verifiedContributionIds.length > 0) {
      for (const cId of verifiedContributionIds) {
        const shareClient = await pool.connect();
        try {
          await shareClient.query('BEGIN');
          await ShareSync.syncContributionToShares(shareClient, cId);
          await shareClient.query('COMMIT');
        } catch (syncErr) {
          await shareClient.query('ROLLBACK');
          logger.error('Bulk share sync failed (non-fatal)', { error: syncErr.message, contributionId: cId });
        } finally {
          shareClient.release();
        }
      }
    }

    // Emit real-time bulk event
    setImmediate(() => {
      try {
        const io = getIo();
        io.to(`chama_${chamaId}`).emit("contribution_recorded", {
          chamaId,
          bulk: true,
          count: successes.length,
          totalAmount: Money.fromCents(contributions.reduce((acc, c) => acc + Money.toCents(c.amount), 0))
        });
      } catch (err) {
        logger.warn("Bulk WebSocket emission failed", { error: err.message });
      }
    });

    const response = {
      status: 201,
      body: {
        success: true,
        message: `${successes.length} contributions recorded successfully`,
        data: {
          chamaId,
          count: successes.length,
          totalAmount: Money.fromCents(contributions.reduce((acc, c) => acc + Money.toCents(c.amount), 0)),
          chamaBalance: updatedChamaFund,
          cycleId: roscaCycle?.cycle_id || null,
          cycleName: roscaCycle?.cycle_name || null,
        },
        ...(roscaCycle?.warningNoActive ? { warning: 'No ACTIVE cycle found. Contributions linked to PENDING cycle.' } : {})
      }
    };

    await IdempotencyService.store(idempotencyKey, response);

    return res.status(201).json(response.body);

  } catch (err) {
    if (client) await client.query("ROLLBACK");
    
    if (err.code === "40001") {
      return next(new AppError("Concurrent transaction conflict. Please retry.", 409, "SERIALIZATION_ERROR"));
    }

    logger.error("Bulk contribution recording failed", { error: err.message, chamaId: req.params.chamaId });
    next(err);
  } finally {
    if (client) client.release();
  }
};

// ============================================================================
// GET CONTRIBUTIONS
// ============================================================================

const getContributions = async (req, res, next) => {
  try {
    console.log("DEBUG: getContributions called");
    console.log("Params:", req.params);
    console.log("Query:", req.query);
    console.log("User:", req.user);

    const { chamaId } = req.params;
    const { page = 1, limit = 20, userId, startDate, endDate } = req.query;

    // Authorization check
    if (!req.user || !req.user.user_id) {
      console.error("AUTH ERROR: req.user is missing in getContributions");
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

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

    // Safe pagination parsing
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Ensure valid numbers, default if NaN or < 1
    const safePage = (!isNaN(pageNum) && pageNum > 0) ? pageNum : 1;
    const safeLimit = (!isNaN(limitNum) && limitNum > 0) ? limitNum : 20;

    const offset = (safePage - 1) * safeLimit;
    let query = `
      SELECT c.contribution_id, c.chama_id, c.user_id, c.amount, c.cycle_id,
             c.payment_method, c.receipt_number, c.contribution_date, c.created_at,
             c.verification_status, c.status, c.notes,
             u.first_name || ' ' || u.last_name as contributor_name,
             r.first_name || ' ' || r.last_name as recorded_by_name
      FROM contributions c
      JOIN users u ON c.user_id = u.user_id
      LEFT JOIN users r ON c.recorded_by = r.user_id
      WHERE c.chama_id = $1 AND c.is_deleted = false
    `;

    const params = [chamaId];
    let paramIndex = 2;

    if (userId && userId !== "undefined" && userId !== "null" && !isNaN(parseInt(userId))) {
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
    params.push(safeLimit, offset);

    // Get total count
    let countQuery =
      "SELECT COUNT(*) as total FROM contributions WHERE chama_id = $1 AND is_deleted = false";
    const countParams = [chamaId];
    if (userId && userId !== "undefined" && userId !== "null" && !isNaN(parseInt(userId))) {
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
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    });
  } catch (error) {
    console.error("CRITICAL ERROR in getContributions:", error);
    console.error("Stack:", error.stack);
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
// SUBMIT CONTRIBUTION (For Members - Self Service)
// ============================================================================

const submitContribution = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const client = await pool.connect();
  try {
    const { chamaId } = req.params;
    const { amount, paymentMethod, receiptNumber, paymentProof, notes } = req.body;
    const userId = req.user.user_id;

    // 1. Verify membership
    const memberCheck = await client.query(
      'SELECT is_active FROM chama_members WHERE chama_id = $1 AND user_id = $2',
      [chamaId, userId]
    );

    if (memberCheck.rows.length === 0 || !memberCheck.rows[0].is_active) {
      throw new AppError('Active membership required', 403, 'NOT_MEMBER');
    }

    // 2. Create contribution entry as PENDING
    const result = await client.query(`
      INSERT INTO contributions 
      (chama_id, user_id, amount, payment_method, receipt_number, payment_proof, notes, verification_status, status, contribution_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', 'PENDING', NOW())
      RETURNING *
    `, [chamaId, req.user.user_id, amount, paymentMethod || 'MPESA', receiptNumber, paymentProof, notes]);

    const contribution = result.rows[0];

    // 3. Notify officials
    const officials = await client.query(
      "SELECT user_id FROM chama_members WHERE chama_id = $1 AND role IN ('CHAIRPERSON', 'TREASURER')",
      [chamaId]
    );

    for (const official of officials.rows) {
      await client.query(`
        INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
        VALUES ($1, 'CONTRIBUTION_SUBMITTED', 'New Contribution Submission', 
                'A member has submitted an M-Pesa contribution for verification', 'CONTRIBUTION', $2)
      `, [official.user_id, contribution.contribution_id]);
    }

    // Response formatting
    const responseData = {
      success: true,
      message: 'Contribution submitted for verification',
      data: contribution
    };

    // Emit real-time event
    setImmediate(() => {
      try {
        if (process.env.NODE_ENV !== 'test') {
          const io = getIo();
          io.to(`chama_${chamaId}`).emit('contribution_submitted', {
            chamaId,
            contribution_id: contribution.contribution_id
          });
        }
      } catch (err) {
        logger.warn('Socket notification failed', { error: err.message });
      }
    });

    res.status(201).json(responseData);
  } catch (error) {
    next(error);
  } finally {
    client.release();
  }
};

// ============================================================================
// VERIFY CONTRIBUTION (For Officials)
// ============================================================================

const verifyContribution = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { chamaId, id } = req.params;
    const { status, verificationNotes } = req.body; // 'VERIFIED' or 'REJECTED'

    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      throw new AppError('Invalid verification status' , 400, 'INVALID_STATUS');
    }

    // 1. Check authorization
    await checkChamaAuthorization(client, chamaId, req.user.user_id, ['TREASURER', 'CHAIRPERSON']);

    await client.query('BEGIN');

    // 2. Get and lock contribution
    const contributionRes = await client.query(
      'SELECT * FROM contributions WHERE contribution_id = $1 AND chama_id = $2 FOR UPDATE',
      [id, chamaId]
    );

    if (contributionRes.rows.length === 0) {
      throw new AppError('Contribution not found', 404, 'NOT_FOUND');
    }

    const contribution = contributionRes.rows[0];

    if (contribution.verification_status === 'VERIFIED') {
      throw new AppError('Contribution already verified', 400, 'ALREADY_VERIFIED');
    }

    // 3. Update status
    const technicalStatus = status === 'VERIFIED' ? 'COMPLETED' : 'FAILED';
    await client.query(`
      UPDATE contributions 
      SET verification_status = $1, 
          status = $2,
          verified_by = $3,
          verified_at = NOW(),
          rejection_reason = $4,
          recorded_by = $3
      WHERE contribution_id = $5
    `, [status, technicalStatus, req.user.user_id, status === 'REJECTED' ? (verificationNotes || 'Rejected by official') : null, id]);

    // 4. If VERIFIED, update balances
    if (status === 'VERIFIED') {
      const amount = parseFloat(contribution.amount);
      
      await client.query(
        'UPDATE chamas SET current_fund = current_fund + $1 WHERE chama_id = $2',
        [amount, chamaId]
      );

      await client.query(
        'UPDATE chama_members SET total_contributions = total_contributions + $1 WHERE chama_id = $2 AND user_id = $3',
        [amount, chamaId, contribution.user_id]
      );

      // Trigger Trust Score Update
      try {
        await TrustScoreService.updateMemberTrustScore(chamaId, contribution.user_id);
      } catch (tsErr) {
        logger.error('Failed to update trust score after verification', { error: tsErr.message });
        // Don't fail the whole transaction for trust score
      }
    }

    await client.query('COMMIT');

    // 5. Notify member
    await client.query(`
      INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
      VALUES ($1, 'CONTRIBUTION_VERIFIED', 'Contribution ${status}', 
              'Your contribution submission has been ${status.toLowerCase()}', 'CONTRIBUTION', $2)
    `, [contribution.user_id, id]);

    res.json({
      success: true,
      message: `Contribution ${status.toLowerCase()} successfully`
    });

    // Emit real-time event
    setImmediate(() => {
      try {
        if (process.env.NODE_ENV !== 'test') {
          const io = getIo();
          io.to(`chama_${chamaId}`).emit('contribution_verified', {
            chamaId,
            contribution_id: id,
            status: status
          });
        }
      } catch (err) {
        logger.warn('Socket notification failed', { error: err.message });
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

// ============================================================================
// GET PENDING CONTRIBUTIONS (Admin view for manual payment verification)
// ============================================================================

const getPendingContributions = async (req, res, next) => {
  const { chamaId } = req.params;
  try {
    // Must be a treasurer or chairperson
    const client = await pool.connect();
    try {
      await checkChamaAuthorization(client, chamaId, req.user.user_id, ['TREASURER', 'CHAIRPERSON', 'ADMIN']);
    } finally {
      client.release();
    }

    const result = await pool.query(
      `SELECT c.contribution_id, c.user_id, c.amount, c.payment_method,
              c.receipt_number, c.payment_proof, c.notes, c.created_at,
              u.first_name, u.last_name, u.phone_number
       FROM contributions c
       JOIN users u ON u.user_id = c.user_id
       WHERE c.chama_id = $1 AND c.verification_status = 'PENDING'
       ORDER BY c.created_at DESC`,
      [chamaId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  recordContribution: [contributionValidation, recordContribution],
  bulkRecordContributions,
  getContributions,
  deleteContribution,
  submitContribution: [contributionValidation, submitContribution],
  verifyContribution,
  getPendingContributions,
  // Export utilities for testing
  Money,
  IdempotencyService,
  DuplicateDetector,
};
