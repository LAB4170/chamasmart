const pool = require("../config/db");
const { isValidAmount, isValidPaymentMethod } = require("../utils/validators");
const { parsePagination, buildLimitClause, formatPaginationMeta, getTotal } = require("../utils/pagination");
const NodeCache = require("node-cache");
const { getIo } = require("../socket");

// Reuse the same cache if possible, or create a new one. 
// Note: In a real app, this would be a shared module.
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Helper to clear contribution-related cache
const clearContributionCache = (chamaId) => {
  if (chamaId) {
    cache.del(`contributions_${chamaId}`);
    // Also clear chama stats as they depend on contributions
    cache.del(`chama_stats_${chamaId}`);
    cache.del(`chama_members_${chamaId}`);
  }
};

// @desc    Record contribution
// @route   POST /api/contributions/:chamaId/record
// @access  Private (Treasurer only)
const recordContribution = async (req, res) => {
  const client = await pool.connect();

  try {
    const { chamaId } = req.params;
    const {
      userId,
      amount,
      paymentMethod,
      receiptNumber,
      notes,
      contributionDate,
    } = req.body;

    // Validation
    if (!userId || !amount) {
      return res.validationError([
        { field: "userId", message: "User ID is required" },
        { field: "amount", message: "Amount is required" }
      ]);
    }

    if (!isValidAmount(amount)) {
      return res.validationError([
        { field: "amount", message: "Amount must be a positive number" }
      ]);
    }

    if (paymentMethod && !isValidPaymentMethod(paymentMethod)) {
      return res.validationError([
        { field: "paymentMethod", message: "Invalid payment method" }
      ]);
    }

    // Check if user is a member of the chama
    const memberCheck = await client.query(
      "SELECT user_id FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true",
      [chamaId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.error("User is not a member of this chama", 400);
    }

    await client.query("BEGIN");

    // Record contribution
    const result = await client.query(
      `INSERT INTO contributions 
       (chama_id, user_id, amount, payment_method, receipt_number, recorded_by, notes, contribution_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING contribution_id, amount, payment_method, contribution_date`,
      [
        chamaId,
        userId,
        amount,
        paymentMethod || "CASH",
        receiptNumber,
        req.user.user_id,
        notes,
        contributionDate || new Date(),
      ]
    );

    // Update chama's current fund
    await client.query(
      "UPDATE chamas SET current_fund = current_fund + $1 WHERE chama_id = $2",
      [amount, chamaId]
    );

    // Update member's total contributions
    await client.query(
      "UPDATE chama_members SET total_contributions = total_contributions + $1 WHERE chama_id = $2 AND user_id = $3",
      [amount, chamaId, userId]
    );

    await client.query("COMMIT");

    // Clear cache
    clearContributionCache(chamaId);

    // Emit socket event for real-time updates
    try {
      const io = getIo();
      io.to(`chama_${chamaId}`).emit("contribution_recorded", {
        chamaId,
        contribution: result.rows[0]
      });
    } catch (err) {
      console.error("Socket emit error:", err.message);
    }

    return res.success(result.rows[0], "Contribution recorded successfully", 201);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Record contribution error:", error);
    return res.error("Error recording contribution", 500);
  } finally {
    client.release();
  }
};

// @desc    Get all contributions for a chama
// @route   GET /api/contributions/:chamaId
// @access  Private
const getChamaContributions = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const { startDate, endDate, userId, page, limit } = req.query;

    // Parse pagination
    const { page: pageNum, limit: limitNum } = parsePagination(page, limit);

    // Only cache if no filters are applied
    const useCache = !startDate && !endDate && !userId && pageNum === 1 && limitNum === 20;
    const cacheKey = `contributions_${chamaId}`;

    if (useCache) {
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        return res.paginated(
          cachedData.data,
          cachedData.total,
          pageNum,
          limitNum,
          "Contributions retrieved successfully"
        );
      }
    }

    let query = `
      SELECT c.contribution_id, c.user_id, c.amount, c.payment_method, c.receipt_number, 
             c.recorded_by, c.notes, c.contribution_date, c.created_at,
             u.first_name || ' ' || u.last_name as contributor_name,
             r.first_name || ' ' || r.last_name as recorded_by_name
      FROM contributions c
      INNER JOIN users u ON c.user_id = u.user_id
      LEFT JOIN users r ON c.recorded_by = r.user_id
      WHERE c.chama_id = $1 AND c.is_deleted = false
    `;

    const params = [chamaId];
    let paramCount = 2;

    if (userId) {
      query += ` AND c.user_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    }

    if (startDate) {
      query += ` AND c.contribution_date >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND c.contribution_date <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM contributions WHERE chama_id = $1 AND is_deleted = false`;
    const countParams = [chamaId];
    const totalCount = await getTotal(countQuery, countParams, "count");

    query += " ORDER BY c.contribution_date DESC, c.created_at DESC";
    query += buildLimitClause(pageNum, limitNum);

    const result = await pool.query(query, params);

    // Calculate total amount for contributions
    const totalAmount = result.rows.reduce(
      (sum, contrib) => sum + parseFloat(contrib.amount),
      0
    );

    if (useCache) {
      cache.set(cacheKey, { data: result.rows, total: totalCount, totalAmount });
    }

    return res.paginated(
      result.rows,
      totalCount,
      pageNum,
      limitNum,
      "Contributions retrieved successfully",
      {
        totalAmount: totalAmount.toFixed(2),
      }
    );
  } catch (error) {
    console.error("Get contributions error:", error);
    return res.error("Error fetching contributions", 500);
  }
};

// @desc    Get single contribution
// @route   GET /api/contributions/:chamaId/:id
// @access  Private
const getContributionById = async (req, res) => {
  try {
    const { chamaId, id } = req.params;

    const result = await pool.query(
      `SELECT c.contribution_id, c.user_id, c.amount, c.payment_method, c.receipt_number, 
              c.recorded_by, c.notes, c.contribution_date, c.created_at,
              u.first_name || ' ' || u.last_name as contributor_name,
              r.first_name || ' ' || r.last_name as recorded_by_name
       FROM contributions c
       INNER JOIN users u ON c.user_id = u.user_id
       LEFT JOIN users r ON c.recorded_by = r.user_id
       WHERE c.chama_id = $1 AND c.contribution_id = $2 AND c.is_deleted = false`,
      [chamaId, id]
    );

    if (result.rows.length === 0) {
      return res.error("Contribution not found", 404);
    }

    return res.success(result.rows[0], "Contribution retrieved successfully");
  } catch (error) {
    console.error("Get contribution error:", error);
    return res.error("Error fetching contribution", 500);
  }
};

// @desc    Delete contribution
// @route   DELETE /api/contributions/:chamaId/:id
// @access  Private (Treasurer only)
const deleteContribution = async (req, res) => {
  const client = await pool.connect();

  try {
    const { chamaId, id } = req.params;

    // Get contribution details first
    const contributionResult = await client.query(
      "SELECT user_id, amount FROM contributions WHERE chama_id = $1 AND contribution_id = $2 AND is_deleted = false",
      [chamaId, id]
    );

    if (contributionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Contribution not found",
      });
    }

    const contribution = contributionResult.rows[0];

    await client.query("BEGIN");

    // Soft delete contribution
    await client.query(
      "UPDATE contributions SET is_deleted = true, deleted_at = NOW() WHERE contribution_id = $1",
      [id]
    );

    // Update chama's current fund
    await client.query(
      "UPDATE chamas SET current_fund = current_fund - $1 WHERE chama_id = $2",
      [contribution.amount, chamaId]
    );

    // Update member's total contributions
    await client.query(
      "UPDATE chama_members SET total_contributions = total_contributions - $1 WHERE chama_id = $2 AND user_id = $3",
      [contribution.amount, chamaId, contribution.user_id]
    );

    await client.query("COMMIT");

    // Clear cache
    clearContributionCache(chamaId);

    // Emit socket event for real-time deletion
    try {
      const io = getIo();
      io.to(`chama_${chamaId}`).emit("contribution_deleted", {
        chamaId,
        contributionId: id
      });
    } catch (err) {
      console.error("Socket emit error:", err.message);
    }

    return res.success(null, "Contribution deleted successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete contribution error:", error);
    return res.error("Error deleting contribution", 500);
  } finally {
    client.release();
  }
};

module.exports = {
  recordContribution,
  getChamaContributions,
  getContributionById,
  deleteContribution,
};
