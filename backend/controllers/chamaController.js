const pool = require('../config/db');
const {
  isValidChamaType,
  isValidFrequency,
  isValidAmount,
} = require('../utils/validators');
const {
  parsePagination,
  formatPaginationMeta,
  getTotal,
} = require('../utils/pagination');

const { cache, clearChamaCache } = require('../utils/cache');
const cacheManager = require('../config/cache');

// @desc    Get all chamas
// @route   GET /api/chamas
// @access  Public
const getAllChamas = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const {
      page: validPage,
      limit: validLimit,
      offset,
    } = parsePagination(page, limit);

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM chamas WHERE is_active = true',
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    const result = await pool.query(
      `SELECT c.chama_id, c.chama_name, c.chama_type, c.description, c.contribution_amount, 
              c.contribution_frequency, c.total_members, c.created_at,
              u.first_name || ' ' || u.last_name as creator_name
       FROM chamas c
       LEFT JOIN users u ON c.created_by = u.user_id
       WHERE c.is_active = true
       ORDER BY c.created_at DESC
       LIMIT $1 OFFSET $2`,
      [validLimit, offset],
    );

    const paginatedData = formatPaginationMeta(
      result.rows,
      total,
      validPage,
      validLimit,
    );

    res.paginated(
      paginatedData.data,
      paginatedData.pagination.page,
      paginatedData.pagination.limit,
      paginatedData.pagination.total,
      'Chamas retrieved successfully',
    );
  } catch (error) {
    console.error('Get all chamas error:', error);
    res.error('Error fetching chamas', 500);
  }
};

// @desc    Get single chama by ID
// @route   GET /api/chamas/:id
// @access  Public
const getChamaById = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const cacheKey = `chama_${chamaId}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData, cached: true });
    }

    const result = await pool.query(
      `SELECT c.chama_id, c.chama_name, c.chama_type, c.description, c.contribution_amount, 
              c.contribution_frequency, c.meeting_day, c.meeting_time, c.current_fund, 
              c.total_members, c.visibility, c.created_at, c.constitution_config,
              c.payment_methods,
              u.first_name || ' ' || u.last_name as creator_name
       FROM chamas c
       LEFT JOIN users u ON c.created_by = u.user_id
       WHERE c.chama_id = $1`,
      [chamaId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chama not found',
      });
    }

    cache.set(cacheKey, result.rows[0]);

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get chama error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chama',
    });
  }
};

// @desc    Create new chama
// @route   POST /api/chamas
// @access  Private
const createChama = async (req, res) => {
  const client = await pool.connect();
  let transactionActive = false;

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
      paymentMethods = {},
      sharePrice,
    } = req.body;
    const userId = req.user.user_id;

    // Validation checks
    if (!chamaName || !chamaType || !contributionAmount || !contributionFrequency) {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    if (!isValidChamaType(chamaType)) {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Invalid chama type',
      });
    }

    if (!isValidFrequency(contributionFrequency)) {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Invalid contribution frequency',
      });
    }

    if (!isValidAmount(contributionAmount)) {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Contribution amount must be a positive number',
      });
    }

    // Default share price for ASCA if not provided
    const finalSharePrice = chamaType === 'ASCA' && !sharePrice ? contributionAmount : sharePrice;

    if (finalSharePrice && !isValidAmount(finalSharePrice)) {
      client.release();
      return res.status(400).json({
        success: false,
        message: 'Share price must be a positive number',
      });
    }

    await client.query('BEGIN');
    transactionActive = true;

    // Check if user already owns too many chamas (optional limit)
    const countResult = await client.query(
      'SELECT COUNT(*) FROM chama_members WHERE user_id = $1 AND role = \'CHAIRPERSON\'',
      [userId],
    );

    if (parseInt(countResult.rows[0].count) >= 10) {
      await client.query('ROLLBACK');
      transactionActive = false;
      client.release();
      return res.status(400).json({
        success: false,
        message: 'You cannot create more than 10 chamas',
      });
    }

    // Generate simple 6-char invite code
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create chama
    const chamaResult = await client.query(
      `INSERT INTO chamas 
       (chama_name, chama_type, description, contribution_amount, contribution_frequency, 
        meeting_day, meeting_time, created_by, total_members, visibility, invite_code, payment_methods, share_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10, $11, $12)
       RETURNING *`,
      [
        chamaName,
        chamaType,
        description,
        contributionAmount,
        contributionFrequency,
        meetingDay,
        meetingTime || null,
        userId,
        visibility || 'PRIVATE',
        inviteCode,
        JSON.stringify(paymentMethods || {}),
        finalSharePrice,
      ],
    );

    const chama = chamaResult.rows[0];

    // Add creator as CHAIRPERSON
    await client.query(
      `INSERT INTO chama_members (chama_id, user_id, role, rotation_position)
       VALUES ($1, $2, 'CHAIRPERSON', 1)`,
      [chama.chama_id, userId],
    );

    await client.query('COMMIT');
    transactionActive = false;
    client.release();

    // Clear relevant caches
    clearChamaCache();

    res.status(201).json({
      success: true,
      message: 'Chama created successfully',
      data: chama,
    });
  } catch (error) {
    if (transactionActive) {
      try { await client.query('ROLLBACK'); } catch (rollbackErr) { console.error('Rollback failed:', rollbackErr); }
    }
    if (client) client.release();
    
    console.error('Create chama error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating chama',
      error: error.message,
    });
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
      paymentMethods,
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
          message: 'Invalid contribution amount',
        });
      }
      updates.push(`contribution_amount = $${paramCount++}`);
      values.push(contributionAmount);
    }
    if (contributionFrequency) {
      if (!isValidFrequency(contributionFrequency)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid contribution frequency',
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
          message: 'Visibility must be PUBLIC or PRIVATE',
        });
      }

      // Chairperson-only enforcement for visibility
      const userRoleResult = await pool.query(
        'SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2',
        [chamaId, req.user.user_id],
      );

      if (userRoleResult.rows.length === 0 || userRoleResult.rows[0].role !== 'CHAIRPERSON') {
        return res.status(403).json({
          success: false,
          message: 'Only the Chairperson can change Chama visibility',
        });
      }

      updates.push(`visibility = $${paramCount++}`);
      values.push(visibility);
    }
    if (constitution_config) {
      updates.push(`constitution_config = $${paramCount++}`);
      values.push(constitution_config); // Pass as JSON object, pg handles it
    }
    if (paymentMethods) {
      updates.push(`payment_methods = $${paramCount++}`);
      values.push(JSON.stringify(paymentMethods));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    values.push(chamaId);

    const query = `UPDATE chamas SET ${updates.join(
      ', ',
    )} WHERE chama_id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    // Clear cache
    clearChamaCache(chamaId);

    res.json({
      success: true,
      message: 'Chama updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update chama error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating chama',
    });
  }
};

// @desc    Delete (deactivate) chama with dual-official approval
// @route   DELETE /api/chamas/:chamaId
// @access  Private (Officials only)
const deleteChama = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const userId = req.user.user_id;

    // Check if a deletion is already pending
    const chamaResult = await pool.query(
      'SELECT chama_name, deletion_requested_by, is_active FROM chamas WHERE chama_id = $1',
      [chamaId],
    );

    if (chamaResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Chama not found' });
    }

    const chama = chamaResult.rows[0];

    if (!chama.is_active) {
      return res.status(400).json({ success: false, message: 'Chama is already deactivated' });
    }

    if (!chama.deletion_requested_by) {
      // First official initiates
      await pool.query(
        'UPDATE chamas SET deletion_requested_by = $1, deletion_requested_at = NOW() WHERE chama_id = $2',
        [userId, chamaId],
      );

      // Clear cache
      clearChamaCache(chamaId);

      return res.json({
        success: true,
        pending: true,
        message: 'Deletion request initiated. A different official must confirm this action to proceed.',
      });
    }

    // Second official confirms
    if (chama.deletion_requested_by === userId) {
      return res.status(400).json({
        success: false,
        message: 'A different official must confirm the deletion request.',
      });
    }

    // Deactivate
    await pool.query(
      'UPDATE chamas SET is_active = false, updated_at = NOW() WHERE chama_id = $1',
      [chamaId],
    );

    // Clear cache
    clearChamaCache(chamaId);

    res.json({
      success: true,
      message: `Chama "${chama.chama_name}" has been successfully deactivated.`,
    });
  } catch (error) {
    console.error('Delete chama error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing deletion request',
    });
  }
};

// @desc    Cancel a pending deletion request
// @route   POST /api/chamas/:chamaId/cancel-delete
// @access  Private (Officials only)
const cancelDeleteChama = async (req, res) => {
  try {
    const { chamaId } = req.params;

    await pool.query(
      'UPDATE chamas SET deletion_requested_by = NULL, deletion_requested_at = NULL WHERE chama_id = $1',
      [chamaId],
    );

    clearChamaCache(chamaId);

    res.json({
      success: true,
      message: 'Deletion request cancelled successfully',
    });
  } catch (error) {
    console.error('Cancel delete chama error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling deletion request',
    });
  }
};

// @desc    Get user's chamas (Optimized to fix N+1)
// @route   GET /api/chamas/user/my-chamas
// @access  Private
const getMyChamas = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const {
      page: validPage,
      limit: validLimit,
      offset,
    } = parsePagination(page, limit);
    const userId = req.user.user_id;

    // Use Advanced Redis Cache with a short TTL (30s) to protect against DB stampedes on dashboard load
    const cacheKey = `my_chamas_v1:${userId}:p${validPage}:l${validLimit}`;
    const paginatedData = await cacheManager.getOrSet(cacheKey, async () => {
      // Get total count
      const totalResult = await pool.query(
        `SELECT COUNT(*) as count FROM chamas c
         INNER JOIN chama_members cm ON c.chama_id = cm.chama_id
         WHERE cm.user_id = $1 AND cm.is_active = true AND c.is_active = true`,
        [userId],
      );
      const total = parseInt(totalResult.rows[0].count);

      // Get paginated results
      const result = await pool.query(
        `SELECT c.chama_id, c.chama_name, c.chama_type, c.contribution_amount, 
                c.contribution_frequency, c.total_members, c.current_fund,
                cm.role, cm.join_date, cm.total_contributions,
                (SELECT COALESCE(SUM(ls.interest_amount), 0)
                 FROM loan_schedules ls
                 JOIN loans l2 ON ls.loan_id = l2.loan_id
                 WHERE l2.chama_id = c.chama_id AND ls.status = 'PAID') as total_interest_earned
         FROM chamas c
         INNER JOIN chama_members cm ON c.chama_id = cm.chama_id
         WHERE cm.user_id = $1 AND cm.is_active = true AND c.is_active = true
         ORDER BY c.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, validLimit, offset],
      );

      return formatPaginationMeta(
        result.rows,
        total,
        validPage,
        validLimit,
      );
    }, 30); // 30 seconds TTL

    res.paginated(
      paginatedData.data,
      paginatedData.pagination.page,
      paginatedData.pagination.limit,
      paginatedData.pagination.total,
      'Chamas retrieved successfully',
    );
  } catch (error) {
    console.error('Get my chamas error:', error);
    res.error('Error fetching your chamas', 500);
  }
};

// @desc    Get chama members
// @route   GET /api/chamas/:id/members
// @access  Private
const getChamaMembers = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const cacheKey = `chama_members_${chamaId}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({
        success: true,
        count: cachedData.length,
        data: cachedData,
        cached: true,
      });
    }

    const result = await pool.query(
      `SELECT cm.user_id, cm.role, cm.join_date, cm.total_contributions, cm.is_active, cm.trust_score,
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
      [chamaId],
    );

    cache.set(cacheKey, result.rows);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get chama members error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chama members',
    });
  }
};

// @desc    Get chama statistics
// @route   GET /api/chamas/:id/stats
// @access  Private
const getChamaStats = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const cacheKey = `chama_stats_${chamaId}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData, cached: true });
    }

    // Get basic stats and recent activity in one query if possible, or parallel
    const [statsResult] = await Promise.all([
      pool.query(
        `WITH member_stats AS (
           SELECT chama_id, COUNT(*) as member_count
           FROM chama_members
           WHERE chama_id = $1 AND is_active = true
           GROUP BY chama_id
         ),
         contribution_stats AS (
           SELECT 
             chama_id, 
             SUM(amount) as total_amount,
             COUNT(*) FILTER (WHERE contribution_date >= CURRENT_DATE - INTERVAL '30 days') as recent_count
           FROM contributions
           WHERE chama_id = $1 AND is_deleted = false AND status = 'COMPLETED'
           GROUP BY chama_id
         )
         SELECT 
           COALESCE(ms.member_count, 0) as total_members,
           COALESCE(cs.total_amount, 0) as total_contributions,
           COALESCE(cs.recent_count, 0) as recent_contributions,
           ch.current_fund,
           ch.contribution_amount,
           ch.chama_type,
           (SELECT COALESCE(SUM(ls.interest_amount), 0)
            FROM loan_schedules ls
            JOIN loans l2 ON ls.loan_id = l2.loan_id
            WHERE l2.chama_id = ch.chama_id AND ls.status = 'PAID') as total_interest_earned
         FROM chamas ch
         LEFT JOIN member_stats ms ON ch.chama_id = ms.chama_id
         LEFT JOIN contribution_stats cs ON ch.chama_id = cs.chama_id
         WHERE ch.chama_id = $1`,
        [chamaId],
      )
    ]);

    if (statsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chama not found',
      });
    }

    const data = {
      ...statsResult.rows[0],
      total_members: parseInt(statsResult.rows[0].total_members),
      total_contributions: parseFloat(statsResult.rows[0].total_contributions),
      recent_contributions: parseInt(statsResult.rows[0].recent_contributions),
      total_interest_earned: parseFloat(statsResult.rows[0].total_interest_earned || 0)
    };

    cache.set(cacheKey, data);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Get chama stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chama statistics',
    });
  }
};

// @desc    Get public chamas for browsing
// @route   GET /api/chamas/public
// @access  Public
const getPublicChamas = async (req, res) => {
  try {
    const { search, chamaType } = req.query;

    let query = `
      SELECT 
        c.chama_id, 
        c.chama_name, 
        c.chama_type, 
        c.description, 
        c.contribution_amount, 
        c.contribution_frequency, 
        c.total_members, 
        c.created_at,
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

    query += ' ORDER BY c.created_at DESC';

    const result = await pool.query(query, params);

    // Return the data in the format expected by the frontend
    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get public chamas error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching public chamas',
      error: error.message,
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
  cancelDeleteChama,
};
