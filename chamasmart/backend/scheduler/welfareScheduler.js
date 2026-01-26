/**
 * Enhanced Welfare Fund Scheduler
 * Monitors welfare funds and notifies admins of low balances
 *
 * Features:
 * - Batch processing of chama funds
 * - Circuit breaker for notification service
 * - Retry mechanism for failed operations
 * - Comprehensive logging and error handling
 * - Configurable thresholds and batch sizes
 */

const config = require("../config");
const logger = require("../utils/logger");
const { pool } = require("../config/db");
const notificationService = require("../services/notificationService");
const { CircuitBreaker } = require("../middleware/circuitBreaker");
const { executeWithRetry } = require("../utils/retryUtils");

// Configuration with environment variable overrides
const SCHEDULER_CONFIG = {
  LOW_FUND_THRESHOLD: parseFloat(process.env.WELFARE_LOW_FUND_THRESHOLD) || 3, // x times max payout
  BATCH_SIZE: parseInt(process.env.NOTIFICATION_BATCH_SIZE) || 50,
  MAX_RETRIES: parseInt(process.env.SCHEDULER_MAX_RETRIES) || 3,
  INITIAL_RETRY_DELAY: parseInt(process.env.SCHEDULER_RETRY_DELAY) || 1000, // 1 second
  CIRCUIT_BREAKER_THRESHOLD: 5, // failures before opening circuit
  CIRCUIT_BREAKER_TIMEOUT: 60000, // 1 minute
};

// Circuit breaker for notification service
const notificationCircuitBreaker = new CircuitBreaker({
  failureThreshold: SCHEDULER_CONFIG.CIRCUIT_BREAKER_THRESHOLD,
  resetTimeout: SCHEDULER_CONFIG.CIRCUIT_BREAKER_TIMEOUT,
  name: "NotificationService",
});

/**
 * Main scheduler function to check welfare funds
 * @returns {Promise<Object>} Execution statistics
 */
const checkWelfareFunds = async () => {
  const startTime = Date.now();
  let processedCount = 0;
  let errorCount = 0;
  const executionId = `welfare-check-${Date.now()}`;

  try {
    logger.info("Starting welfare fund check", {
      executionId,
      timestamp: new Date().toISOString(),
      config: {
        threshold: SCHEDULER_CONFIG.LOW_FUND_THRESHOLD,
        batchSize: SCHEDULER_CONFIG.BATCH_SIZE,
      },
    });

    // Fetch chamas with low welfare funds with retry mechanism
    const { rows: lowFunds } = await executeWithRetry(
      fetchLowWelfareFunds,
      ["Error fetching low welfare funds"],
      SCHEDULER_CONFIG.MAX_RETRIES,
      SCHEDULER_CONFIG.INITIAL_RETRY_DELAY,
    );

    logger.info(`Found ${lowFunds.length} chamas with low welfare funds`, {
      executionId,
    });

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < lowFunds.length; i += SCHEDULER_CONFIG.BATCH_SIZE) {
      const batch = lowFunds.slice(i, i + SCHEDULER_CONFIG.BATCH_SIZE);

      await Promise.all(
        batch.map((fund) =>
          processChamaFundCheck(fund, executionId)
            .then(() => processedCount++)
            .catch((error) => {
              errorCount++;
              logger.error("Error processing chama fund check", {
                executionId,
                chamaId: fund.chama_id,
                error: error.message,
                stack: error.stack,
              });
            }),
        ),
      );
    }

    const result = {
      success: true,
      totalProcessed: processedCount,
      totalErrors: errorCount,
      durationMs: Date.now() - startTime,
      executionId,
    };

    logger.info("Completed welfare fund check", result);
    return result;
  } catch (error) {
    const errorResult = {
      success: false,
      error: error.message,
      processedCount,
      errorCount,
      durationMs: Date.now() - startTime,
      executionId: executionId || "unknown",
    };

    logger.error("Critical error in welfare fund scheduler", {
      ...errorResult,
      stack: error.stack,
    });

    // Trigger alert for critical failures
    notificationService
      .sendAdminAlert({
        type: "CRITICAL",
        message: "Welfare fund scheduler failed",
        error: error.message,
        executionId: executionId || "unknown",
        timestamp: new Date().toISOString(),
      })
      .catch((e) =>
        logger.error("Failed to send admin alert", {
          executionId: executionId || "unknown",
          error: e.message,
        }),
      );

    throw errorResult;
  }
};

/**
 * Fetches chamas with welfare funds below the configured threshold
 * @returns {Promise<Array>} List of chamas with low welfare funds
 */
const fetchLowWelfareFunds = async () => {
  const query = `
        WITH max_payouts AS ( 
            SELECT 
                chama_id, 
                MAX(amount) as max_payout
            FROM member_payouts
            WHERE status = 'completed'
            GROUP BY chama_id
        )
        SELECT 
            fb.chama_id, 
            c.name as chama_name,
            fb.balance, 
            mp.max_payout,
            (mp.max_payout * $1) as threshold,
            ROUND((fb.balance / (mp.max_payout * $1)) * 100, 2) as percentage_of_threshold
        FROM welfare_fund_balance fb
        JOIN chamas c ON fb.chama_id = c.id
        JOIN max_payouts mp ON fb.chama_id = mp.chama_id
        WHERE fb.balance < (mp.max_payout * $1)
        AND c.is_active = true
        ORDER BY (mp.max_payout * $1 - fb.balance) DESC
        FOR UPDATE SKIP LOCKED;
    `;

  const { rows } = await pool.query(query, [
    SCHEDULER_CONFIG.LOW_FUND_THRESHOLD,
  ]);
  return { rows };
};

/**
 * Process fund check for a single chama
 * @param {Object} fund - Chama fund details
 * @param {string} executionId - Unique ID for this execution
 */
const processChamaFundCheck = async (fund, executionId) => {
  const logContext = {
    executionId,
    chamaId: fund.chama_id,
    chamaName: fund.chama_name,
    balance: fund.balance,
    threshold: fund.threshold,
    percentageOfThreshold: fund.percentage_of_threshold,
  };

  try {
    // Get active admins for the chama
    const admins = await getChamaAdmins(fund.chama_id);

    if (admins.length === 0) {
      logger.warn("No active admins found for chama", logContext);
      return;
    }

    // Format balance and threshold for display
    const formattedBalance = new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(fund.balance);

    const formattedThreshold = new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(fund.threshold);

    // Prepare notification
    const notification = {
      type: "WELFARE_FUND_LOW",
      title: `Low Welfare Funds - ${fund.chama_name}`,
      message: `The welfare fund balance (${formattedBalance}) is below the threshold (${formattedThreshold})`,
      data: {
        chamaId: fund.chama_id,
        chamaName: fund.chama_name,
        currentBalance: fund.balance,
        formattedBalance,
        threshold: fund.threshold,
        formattedThreshold,
        maxPayout: fund.max_payout,
        percentageOfThreshold: fund.percentage_of_threshold,
        executionId,
      },
      recipients: admins.map((admin) => admin.user_id),
    };

    // Send notification with circuit breaker protection
    await notificationCircuitBreaker.execute(() =>
      notificationService.send(notification),
    );

    logger.info("Sent low fund notification", {
      ...logContext,
      adminCount: admins.length,
      notificationType: notification.type,
    });
  } catch (error) {
    logger.error("Error processing chama fund check", {
      ...logContext,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

/**
 * Get active admins for a chama
 * @param {string|number} chamaId - ID of the chama
 * @returns {Promise<Array>} List of admin users
 */
const getChamaAdmins = async (chamaId) => {
  const query = `
        SELECT 
            user_id,
            (SELECT email FROM users WHERE id = user_id) as email
        FROM chama_members 
        WHERE chama_id = $1 
        AND role IN ('admin', 'treasurer', 'chairperson')
        AND status = 'active'
    `;

  const { rows } = await pool.query(query, [chamaId]);
  return rows;
};

// Export for testing and scheduling
module.exports = {
  checkWelfareFunds,
  fetchLowWelfareFunds,
  processChamaFundCheck,
  getChamaAdmins,
  // Expose for testing
  _config: SCHEDULER_CONFIG,
};
