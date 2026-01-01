const pool = require("../config/db");
const {
  isValidChamaType,
  isValidFrequency,
  isValidAmount,
} = require("../utils/validators");
const NodeCache = require("node-cache");

// Initialize cache with 5 minutes (300 seconds) standard TTL
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Helper to clear chama-related cache
const clearChamaCache = (chamaId) => {
  if (chamaId) {
    cache.del(`chama_${chamaId}`);
    cache.del(`chama_stats_${chamaId}`);
    cache.del(`chama_members_${chamaId}`);
  }
  // Also clear general lists
  cache.del("all_chamas");
  cache.del("public_chamas");
};

// @desc    Get all chamas
// @route   GET /api/chamas
// @access  Public
const getAllChamas = async (req, res) => {
  try {
    const cacheKey = "all_chamas";
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, count: cachedData.length, data: cachedData, cached: true });
    }

    const result = await pool.query(
      `SELECT c.chama_id, c.chama_name, c.chama_type, c.description, c.contribution_amount, 
              c.contribution_frequency, c.total_members, c.created_at,
              u.first_name || ' ' || u.last_name as creator_name
       FROM chamas c
       LEFT JOIN users u ON c.created_by = u.user_id
       WHERE c.is_active = true
       ORDER BY c.created_at DESC`
    );

    cache.set(cacheKey, result.rows);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get all chamas error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching chamas",
    });
  }
};

// @desc    Get single chama by ID
// @route   GET /api/chamas/:id
// @access  Public
const getChamaById = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `chama_${id}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData, cached: true });
    }

    const result = await pool.query(
      `SELECT c.chama_id, c.chama_name, c.chama_type, c.description, c.contribution_amount, 
              c.contribution_frequency, c.meeting_day, c.meeting_time, c.current_fund, 
              c.contribution_frequency, c.meeting_day, c.meeting_time, c.current_fund, 
              c.total_members, c.visibility, c.created_at, c.constitution_config,
              u.first_name || ' ' || u.last_name as creator_name
       FROM chamas c
       LEFT JOIN users u ON c.created_by = u.user_id
       WHERE c.chama_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Chama not found",
      });
    }

    cache.set(cacheKey, result.rows[0]);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get chama error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching chama",
    });
  }
};

// @desc    Create new chama
// @route   POST /api/chamas
// @access  Private
const createChama = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      chamaName,
      chamaType,
      description,
      contributionAmount,
      contributionFrequency,
      meetingDay,
      meetingTime,
      visibility = 'PRIVATE',
    } = req.body;

    // Validation
    if (
      !chamaName ||
      !chamaType ||
      !contributionAmount ||
      !contributionFrequency
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    if (!isValidChamaType(chamaType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chama type",
      });
    }

    if (!isValidFrequency(contributionFrequency)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contribution frequency",
      });
    }

    if (!isValidAmount(contributionAmount)) {
      return res.status(400).json({
        success: false,
        message: "Contribution amount must be a positive number",
      });
    }

    await client.query("BEGIN");

    // Validate visibility
    if (!['PUBLIC', 'PRIVATE'].includes(visibility)) {
      return res.status(400).json({
        success: false,
        message: "Visibility must be PUBLIC or PRIVATE",
      });
    }

    // Generate simple 6-char invite code
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create chama
    const chamaResult = await client.query(
      `INSERT INTO chamas 
       (chama_name, chama_type, description, contribution_amount, contribution_frequency, 
        meeting_day, meeting_time, created_by, total_members, visibility, invite_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10)
       RETURNING *`,
      [
        chamaName,
        chamaType,
        description,
        contributionAmount,
        contributionFrequency,
        meetingDay,
        meetingTime,
        req.user.user_id,
        visibility,
        inviteCode
      ]
    );

    const chama = chamaResult.rows[0];

    // Add creator as CHAIRPERSON
    await client.query(
      `INSERT INTO chama_members (chama_id, user_id, role, rotation_position)
       VALUES ($1, $2, 'CHAIRPERSON', 1)`,
      [chama.chama_id, req.user.user_id]
    );

    await client.query("COMMIT");

    // Clear relevant caches
    clearChamaCache();

    res.status(201).json({
      success: true,
      message: "Chama created successfully",
      data: chama,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create chama error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating chama",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

// @desc    Update chama
// @route   PUT /api/chamas/:chamaId
// @access  Private (Officials only)
const updateChama = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const {
      chamaName,
      description,
      contributionAmount,
      contributionFrequency,
      meetingDay,
      meetingTime,
      visibility,
      constitution_config,
    } = req.body;

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (chamaName) {
      updates.push(`chama_name = $${paramCount++}`);
      values.push(chamaName);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (contributionAmount) {
      if (!isValidAmount(contributionAmount)) {
        return res.status(400).json({
          success: false,
          message: "Invalid contribution amount",
        });
      }
      updates.push(`contribution_amount = $${paramCount++}`);
      values.push(contributionAmount);
    }
    if (contributionFrequency) {
      if (!isValidFrequency(contributionFrequency)) {
        return res.status(400).json({
          success: false,
          message: "Invalid contribution frequency",
        });
      }
      updates.push(`contribution_frequency = $${paramCount++}`);
      values.push(contributionFrequency);
    }
    if (meetingDay) {
      updates.push(`meeting_day = $${paramCount++}`);
      values.push(meetingDay);
    }
    if (meetingTime) {
      updates.push(`meeting_time = $${paramCount++}`);
      values.push(meetingTime);
    }
    if (visibility) {
      if (!['PUBLIC', 'PRIVATE'].includes(visibility)) {
        return res.status(400).json({
          success: false,
          message: "Visibility must be PUBLIC or PRIVATE",
        });
      }
      updates.push(`visibility = $${paramCount++}`);
      values.push(visibility);
    }
    if (constitution_config) {
      updates.push(`constitution_config = $${paramCount++}`);
      values.push(constitution_config); // Pass as JSON object, pg handles it
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    values.push(chamaId);

    const query = `UPDATE chamas SET ${updates.join(
      ", "
    )} WHERE chama_id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    // Clear cache
    clearChamaCache(chamaId);

    res.json({
      success: true,
      message: "Chama updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update chama error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating chama",
    });
  }
};

// @desc    Delete (deactivate) chama
// @route   DELETE /api/chamas/:chamaId
// @access  Private (Officials only)
const deleteChama = async (req, res) => {
  try {
    const { chamaId } = req.params;

    await pool.query(
      "UPDATE chamas SET is_active = false WHERE chama_id = $1",
      [chamaId]
    );

    // Clear cache
    clearChamaCache(chamaId);

    res.json({
      success: true,
      message: "Chama deactivated successfully",
    });
  } catch (error) {
    console.error("Delete chama error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting chama",
    });
  }
};

// @desc    Get user's chamas (Optimized to fix N+1)
// @route   GET /api/chamas/user/my-chamas
// @access  Private
const getMyChamas = async (req, res) => {
  try {
    // Optimized single query to get chamas, roles AND totals in one go
    // This avoids needing multiple queries per chama on the frontend or backend
    const result = await pool.query(
      `SELECT c.chama_id, c.chama_name, c.chama_type, c.contribution_amount, 
              c.contribution_frequency, c.total_members,
              cm.role, cm.join_date, cm.total_contributions
       FROM chamas c
       INNER JOIN chama_members cm ON c.chama_id = cm.chama_id
       WHERE cm.user_id = $1 AND cm.is_active = true AND c.is_active = true
       ORDER BY c.created_at DESC`,
      [req.user.user_id]
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get my chamas error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching your chamas",
    });
  }
};

// @desc    Get chama members
// @route   GET /api/chamas/:id/members
// @access  Private
const getChamaMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `chama_members_${id}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, count: cachedData.length, data: cachedData, cached: true });
    }

    const result = await pool.query(
      `SELECT cm.user_id, cm.role, cm.join_date, cm.total_contributions, cm.is_active,
              u.first_name, u.last_name, u.email, u.phone_number
       FROM chama_members cm
       INNER JOIN users u ON cm.user_id = u.user_id
       WHERE cm.chama_id = $1 AND cm.is_active = true
       ORDER BY 
         CASE cm.role
           WHEN 'CHAIRPERSON' THEN 1
           WHEN 'TREASURER' THEN 2
           WHEN 'SECRETARY' THEN 3
           ELSE 4
         END,
         cm.join_date ASC`,
      [id]
    );

    cache.set(cacheKey, result.rows);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get chama members error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching chama members",
    });
  }
};

// @desc    Get chama statistics
// @route   GET /api/chamas/:id/stats
// @access  Private
const getChamaStats = async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `chama_stats_${id}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData, cached: true });
    }

    // Get basic stats and recent activity in one query if possible, or parallel
    const [statsResult, activityResult] = await Promise.all([
      pool.query(
        `SELECT 
           COUNT(DISTINCT cm.user_id) as total_members,
           COALESCE(SUM(c.amount), 0) as total_contributions,
           ch.current_fund,
           ch.contribution_amount,
           ch.chama_type
         FROM chamas ch
         LEFT JOIN chama_members cm ON ch.chama_id = cm.chama_id AND cm.is_active = true
         LEFT JOIN contributions c ON ch.chama_id = c.chama_id
         WHERE ch.chama_id = $1
         GROUP BY ch.chama_id, ch.current_fund, ch.contribution_amount, ch.chama_type`,
        [id]
      ),
      pool.query(
        `SELECT COUNT(*) as recent_contributions
         FROM contributions
         WHERE chama_id = $1 AND contribution_date >= CURRENT_DATE - INTERVAL '30 days'`,
        [id]
      )
    ]);

    if (statsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Chama not found",
      });
    }

    const data = {
      ...statsResult.rows[0],
      recent_contributions: parseInt(activityResult.rows[0].recent_contributions),
    };

    cache.set(cacheKey, data);

    res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error("Get chama stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching chama statistics",
    });
  }
};

// @desc    Get public chamas for browsing
// @route   GET /api/chamas/public
// @access  Public
const getPublicChamas = async (req, res) => {
  try {
    const { search, chamaType } = req.query;

    // We don't cache search results easily here, but we could cache the base query
    let query = `
      SELECT c.chama_id, c.chama_name, c.chama_type, c.description, c.contribution_amount, 
             c.contribution_frequency, c.total_members, c.created_at,
             u.first_name || ' ' || u.last_name as creator_name
      FROM chamas c
      LEFT JOIN users u ON c.created_by = u.user_id
      WHERE c.is_active = true AND c.visibility = 'PUBLIC'
    `;

    const params = [];
    let paramIndex = 1;

    if (search) {
      query += ` AND (c.chama_name ILIKE $${paramIndex} OR c.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (chamaType) {
      query += ` AND c.chama_type = $${paramIndex}`;
      params.push(chamaType);
      paramIndex++;
    }

    query += ` ORDER BY c.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get public chamas error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching public chamas",
    });
  }
};

module.exports = {
  getAllChamas,
  getChamaById,
  createChama,
  updateChama,
  deleteChama,
  getMyChamas,
  getChamaMembers,
  getChamaStats,
  getPublicChamas,
};
