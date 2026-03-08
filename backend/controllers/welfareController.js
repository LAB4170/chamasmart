const pool = require('../config/db');
const logger = require('../utils/logger');
const { uploadToStorage } = require('../utils/storage');
const {
  sendNotification,
  sendChamaNotification,
  sendOfficialNotification,
  notificationTemplates,
} = require('../utils/notifications');
const {
  parsePagination,
  buildLimitClause,
  getTotal,
} = require('../utils/pagination');

// Welfare Configuration Management
const getWelfareConfig = async (req, res) => {
  const { chamaId } = req.params;
  try {
    const query = `
      SELECT wc.config_id as id, wc.*, COUNT(wcl.claim_id) as active_claims
      FROM welfare_config wc
      LEFT JOIN welfare_claims wcl ON wc.config_id = wcl.event_type_id 
        AND wcl.status IN ('SUBMITTED', 'VERIFIED', 'APPROVED')
      WHERE wc.chama_id = $1
      GROUP BY wc.config_id
      ORDER BY wc.event_type
    `;
    const { rows } = await pool.query(query, [chamaId]);
    return res.success(rows, 'Welfare configurations retrieved successfully');
  } catch (error) {
    logger.error('Error fetching welfare config:', error);
    return res.error('Error fetching welfare configuration', 500);
  }
};

const updateWelfareConfig = async (req, res) => {
  const { id } = req.params;
  const {
    event_type,
    description,
    payout_amount,
    contribution_type,
    contribution_amount,
    is_active,
  } = req.body;

  try {
    const query = `
      UPDATE welfare_config 
      SET event_type = $1, 
          description = $2, 
          payout_amount = $3, 
          contribution_type = $4, 
          contribution_amount = $5,
          is_active = $6,
          updated_at = CURRENT_TIMESTAMP
      WHERE config_id = $7
      RETURNING *
    `;
    const { rows } = await pool.query(query, [
      event_type,
      description,
      payout_amount,
      contribution_type,
      contribution_amount,
      is_active,
      id,
    ]);

    if (rows.length === 0) {
      return res.error('Welfare configuration not found', 404);
    }

    return res.success(rows[0], 'Welfare configuration updated successfully');
  } catch (error) {
    logger.error('Error updating welfare config:', error);
    return res.error('Error updating welfare configuration', 500);
  }
};

// Welfare Fund Management
const getWelfareFund = async (req, res) => {
  const { chamaId } = req.params;
  try {
    // Return unified fund from chamas table instead of separate welfare_fund table
    const query = 'SELECT current_fund FROM chamas WHERE chama_id = $1';
    const { rows } = await pool.query(query, [chamaId]);

    const unifiedBalance = rows.length > 0 ? rows[0].current_fund : 0;

    return res.success(
      {
        fund_id: parseInt(chamaId),
        chama_id: parseInt(chamaId),
        balance: unifiedBalance
      },
      'Welfare fund retrieved successfully'
    );
  } catch (error) {
    logger.error('Error fetching welfare fund:', error);
    return res.error('Error fetching welfare fund', 500);
  }
};

const makeWelfareContribution = async (req, res) => {
  const { chamaId } = req.params;
  const { amount, paymentMethod } = req.body;
  const userId = req.user.user_id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Make sure fund exists
    const checkFund = await client.query('SELECT fund_id FROM welfare_fund WHERE chama_id = $1', [chamaId]);
    if (checkFund.rows.length === 0) {
       await client.query('INSERT INTO welfare_fund (chama_id, balance) VALUES ($1, 0)', [chamaId]);
    }

    // 1. Record the contribution
    const contributionQuery = `
      INSERT INTO welfare_contributions (chama_id, member_id, amount, status)
      VALUES ($1, $2, $3, 'COMPLETED')
      RETURNING contribution_id as id, *
    `;
    const { rows: [contribution] } = await client.query(contributionQuery, [chamaId, userId, amount]);

    // 2. Update welfare fund balance
    const fundQuery = `
      UPDATE welfare_fund 
      SET balance = balance + $1, last_updated = CURRENT_TIMESTAMP
      WHERE chama_id = $2
      RETURNING *
    `;
    const { rows: [fund] } = await client.query(fundQuery, [amount, chamaId]);

    // 3. Sync to chamas.current_fund if it's a WELFARE chama
    const { rows: [chama] } = await client.query('SELECT chama_type FROM chamas WHERE chama_id = $1', [chamaId]);
    if (chama && chama.chama_type === 'WELFARE') {
      await client.query('UPDATE chamas SET current_fund = current_fund + $1 WHERE chama_id = $2', [amount, chamaId]);
    }

    // 4. Record transaction for general audit log
    await client.query(
      `INSERT INTO transactions (chama_id, member_id, amount, transaction_type, reference_id, status, description)
       VALUES ($1, $2, $3, 'WELFARE_CONTRIBUTION', $4, 'COMPLETED', $5)`,
      [chamaId, userId, amount, contribution.id, `Welfare Contribution via ${paymentMethod || 'CASH'}`]
    );
    
    await client.query('COMMIT');
    
    // Send standard success response pattern
    return res.status(201).json({ 
      success: true, 
      message: 'Welfare contribution recorded successfully.', 
      data: { contribution, new_balance: fund.balance } 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error recording welfare contribution:', error);
    return res.status(500).json({ success: false, message: 'Failed to record welfare contribution.' });
  } finally {
    client.release();
  }
};

// Claim Management
const submitClaim = async (req, res) => {
  const { chamaId } = req.params;
  const memberId = req.user.user_id; // Use logged in user ID from protect middleware
  const { event_type_id, custom_event_name, claim_amount, description, date_of_occurrence } = req.body;
  let proof_document_url = null;

  // --- Validate claim_amount immediately (must be a positive number) ---
  const requestedAmount = parseFloat(claim_amount);
  if (!requestedAmount || isNaN(requestedAmount) || requestedAmount <= 0) {
    return res.status(400).json({ message: 'Please enter a valid claim amount greater than KES 0.' });
  }

  try {
    let eventType = null;

    if (event_type_id) {
      // --- PATH A: Predefined event selected from config ---
      const eventQuery = `
        SELECT config_id as id, * FROM welfare_config 
        WHERE config_id = $1 AND chama_id = $2 AND is_active = true
      `;
      const { rows: [found] } = await pool.query(eventQuery, [event_type_id, chamaId]);
      if (!found) {
        return res.status(400).json({ message: 'Invalid or inactive event type' });
      }
      eventType = found;

      // --- CEILING CHECK: member cannot request more than the configured maximum ---
      const ceiling = parseFloat(eventType.payout_amount);
      if (ceiling > 0 && requestedAmount > ceiling) {
        return res.status(400).json({
          message: `Your request of KES ${requestedAmount.toLocaleString()} exceeds the maximum allowed for ${eventType.event_type.replace(/_/g, ' ')}: KES ${ceiling.toLocaleString()}. Please enter a lower amount.`,
        });
      }
    } else if (custom_event_name && custom_event_name.trim().length > 0) {
      // --- PATH B: Custom free-text event ---
      // Normalize the name: uppercase, trim, replace spaces with underscores
      const normalizedName = custom_event_name.trim().toUpperCase().replace(/\s+/g, '_');

      // Try to find an existing config with same name first
      const existingQuery = `
        SELECT config_id as id, * FROM welfare_config 
        WHERE chama_id = $1 AND event_type = $2
      `;
      const { rows: [existing] } = await pool.query(existingQuery, [chamaId, normalizedName]);

      if (existing) {
        eventType = existing;
        // Enforce ceiling if one exists on this custom type
        const ceiling = parseFloat(eventType.payout_amount);
        if (ceiling > 0 && requestedAmount > ceiling) {
          return res.status(400).json({
            message: `Your request of KES ${requestedAmount.toLocaleString()} exceeds the maximum allowed: KES ${ceiling.toLocaleString()}.`,
          });
        }
      } else {
        // Auto-create a new config entry with payout 0, pending admin approval
        const createQuery = `
          INSERT INTO welfare_config 
            (chama_id, event_type, description, payout_amount, contribution_type, contribution_amount, is_active)
          VALUES ($1, $2, $3, 0, 'AD_HOC', 0, true)
          RETURNING config_id as id, *
        `;
        const { rows: [created] } = await pool.query(createQuery, [
          chamaId,
          normalizedName,
          `Custom event: ${custom_event_name.trim()}`,
        ]);
        eventType = created;
        logger.info(`Auto-created welfare_config for custom event "${normalizedName}" in chama ${chamaId}`);
      }
    } else {
      return res.status(400).json({ message: 'You must select an event type or enter a custom event name.' });
    }

    // --- ELIGIBILITY AND INTEGRITY GUARDS ---

    // 1. Fund sufficiency check — against the ACTUAL requested amount, not the ceiling
    const chamaQuery = 'SELECT chama_type, current_fund FROM chamas WHERE chama_id = $1';
    const { rows: [chama] } = await pool.query(chamaQuery, [chamaId]);
    
    let currentBalance = 0;
    if (chama && chama.chama_type === 'WELFARE') {
      currentBalance = parseFloat(chama.current_fund || 0);
    } else {
      const fundQuery = 'SELECT balance FROM welfare_fund WHERE chama_id = $1';
      const { rows: [fund] } = await pool.query(fundQuery, [chamaId]);
      currentBalance = fund ? parseFloat(fund.balance || 0) : 0;
    }

    if (currentBalance < requestedAmount) {
      return res.status(400).json({
        message: `Insufficient welfare fund balance. The fund currently holds KES ${currentBalance.toLocaleString()}, but your claim is for KES ${requestedAmount.toLocaleString()}.`,
      });
    }

    // 2. Verify Member Standing (Active Status, Contributions, and Tenure)
    // NOTE: Per Phase 6 requirements, the previous "30-day tenure" rule is waived.
    // Any active member who has successfully contributed is eligible to apply.
    const memberQuery = `
      SELECT cm.join_date as joined_at, 
             (SELECT COALESCE(SUM(amount), 0) FROM contributions WHERE user_id = $1 AND chama_id = $2 AND status = 'COMPLETED') as base_savings,
             (SELECT COALESCE(SUM(amount), 0) FROM welfare_contributions WHERE member_id = $1 AND chama_id = $2 AND status = 'COMPLETED') as welfare_savings
      FROM chama_members cm
      WHERE cm.user_id = $1 AND cm.chama_id = $2 AND cm.is_active = true
    `;
    const { rows: [memberStanding] } = await pool.query(memberQuery, [memberId, chamaId]);

    if (!memberStanding) {
      return res.status(400).json({ message: 'Member is not active in this chama' });
    }

    // Require financial accountability (at least one contribution)
    if (parseFloat(memberStanding.welfare_savings) <= 0 && parseFloat(memberStanding.base_savings) <= 0) {
      return res.status(403).json({ 
        message: 'Member must have actively contributed to the chama to be eligible for welfare claims' 
      });
    }
    // --- END GUARDS ---

    // Handle file upload if present
    // Support both req.file (multer.single) and req.files[0] (multer.array)
    const uploadedFile = req.file || (req.files && req.files[0]) || (req.uploadedFiles && req.uploadedFiles[0]);
    
    if (uploadedFile) {
      try {
        proof_document_url = await uploadToStorage(uploadedFile, `welfare/${chamaId}/claims`);
      } catch (uploadError) {
        logger.error('Error uploading document:', uploadError);
        // Don't fail the whole claim if only the upload fails (optional, but safer)
        // return res.status(500).json({ message: 'Error uploading document' });
      }
    }
    // Create the claim
    const query = `
      INSERT INTO welfare_claims 
        (chama_id, member_id, event_type_id, claim_amount, description, date_of_occurrence, proof_document_url, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'SUBMITTED')
      RETURNING *
    `;
    const { rows: [claim] } = await pool.query(query, [
      chamaId,
      memberId,
      eventType.id,
      requestedAmount,         // ← member's actual need, not the ceiling
      description,
      date_of_occurrence,
      proof_document_url,
    ]);

    await notifyAdminsAboutNewClaim(chamaId, claim.claim_id || claim.id);

    const isCustom = !event_type_id;
    res.status(201).json({
      ...claim,
      claim_type: eventType.event_type,  // explicit alias for frontend rendering
      event_type: eventType.event_type,
      is_custom_event: isCustom,
      ceiling_amount: eventType.payout_amount,
      message: isCustom
        ? 'Custom event claim submitted. An admin will review and set the final payout amount.'
        : `Claim of KES ${requestedAmount.toLocaleString()} submitted successfully. Pending admin approval.`,
    });
  } catch (error) {
    logger.error('Error submitting claim:', error);
    res.status(500).json({ message: 'Error submitting claim' });
  }
};

const getMemberClaims = async (req, res) => {
  const { memberId, chamaId } = req.params;
  const { page, limit } = req.query;

  try {
    // Parse pagination
    const { page: pageNum, limit: limitNum } = parsePagination(page, limit);

    // Get total count
    const countQuery = 'SELECT COUNT(*) as count FROM welfare_claims WHERE member_id = $1 AND chama_id = $2';
    const totalCount = await getTotal(pool, countQuery, [memberId, chamaId], 'count');

    const query = `
      SELECT wc.claim_id as id, wc.*, wcfg.event_type, wcfg.payout_amount, 
             (SELECT COUNT(*) FROM welfare_claim_approvals wca WHERE wca.claim_id = wc.claim_id) as approval_count
      FROM welfare_claims wc
      JOIN welfare_config wcfg ON wc.event_type_id = wcfg.config_id
      WHERE wc.member_id = $1 AND wc.chama_id = $2
      ORDER BY wc.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const { rows } = await pool.query(query, [
      memberId,
      chamaId,
      limitNum,
      (pageNum - 1) * limitNum,
    ]);
    return res.paginated(
      rows,
      pageNum,
      limitNum,
      totalCount,
      'Member claims retrieved successfully',
    );
  } catch (error) {
    logger.error('Error fetching member claims:', error);
    return res.error('Error fetching claims', 500);
  }
};

const getChamaClaims = async (req, res) => {
  const { chamaId } = req.params;
  const { page, limit, status } = req.query;

  try {
    // Parse pagination
    const { page: pageNum, limit: limitNum } = parsePagination(page, limit);

    // Build query
    let countQuery = 'SELECT COUNT(*) as count FROM welfare_claims WHERE chama_id = $1';
    const countParams = [chamaId];

    if (status) {
      countQuery += ' AND status = $2';
      countParams.push(status);
    }

    const totalCount = await getTotal(pool, countQuery, countParams, 'count');

    let query = `
      SELECT wc.claim_id as id, wc.*, wcfg.event_type as claim_type, wcfg.event_type, wcfg.payout_amount,
             u.first_name || ' ' || u.last_name as member_name,
             (SELECT COUNT(*) FROM welfare_claim_approvals wca WHERE wca.claim_id = wc.claim_id) as approval_count
      FROM welfare_claims wc
      JOIN welfare_config wcfg ON wc.event_type_id = wcfg.config_id
      JOIN users u ON wc.member_id = u.user_id
      WHERE wc.chama_id = $1
    `;

    const params = [chamaId];
    if (status) {
      query += ' AND wc.status = $2';
      params.push(status);
    }

    query += `
      ORDER BY 
        CASE WHEN wc.status = 'SUBMITTED' THEN 1 ELSE 2 END,
        wc.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limitNum, (pageNum - 1) * limitNum);

    const { rows } = await pool.query(query, params);
    return res.paginated(
      rows,
      pageNum,
      limitNum,
      totalCount,
      'Chama claims retrieved successfully',
    );
  } catch (error) {
    logger.error('Error fetching chama claims:', error);
    return res.error('Error fetching claims', 500);
  }
};

// Approval Workflow
const approveClaim = async (req, res) => {
  const { claimId } = req.params;
  // approverId should be the authenticated user — fall back to body if explicitly provided
  const approverId = req.user?.user_id || req.body.approverId;
  const { status, comments, reviewer_notes } = req.body;
  const finalComments = comments || reviewer_notes || null;

  const client = await pool.connect();

  try {
    // Start transaction
    await client.query('BEGIN');

    // Record approval
    const approvalQuery = `
      INSERT INTO welfare_claim_approvals (claim_id, approver_id, status, comments)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (claim_id, approver_id) DO UPDATE 
      SET status = EXCLUDED.status, 
          comments = EXCLUDED.comments,
          created_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    await client.query(approvalQuery, [claimId, approverId, status, finalComments]);

    if (status === 'REJECTED') {
      // Any single rejection from an official => mark claim as REJECTED
      await client.query(
        "UPDATE welfare_claims SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE claim_id = $1",
        [claimId],
      );

      // Notify the claimant of rejection
      const { rows: [rejectedClaim] } = await client.query(
        `SELECT wc.member_id, c.chama_name FROM welfare_claims wc
         JOIN chamas c ON wc.chama_id = c.chama_id WHERE wc.claim_id = $1`,
        [claimId],
      );
      if (rejectedClaim) {
        await sendNotification({
          userId: rejectedClaim.member_id,
          title: 'Welfare Claim Rejected',
          message: `Your welfare claim in ${rejectedClaim.chama_name} has been reviewed and rejected. ${finalComments ? 'Note: ' + finalComments : ''}`,
          entityId: claimId,
        }).catch(err => logger.warn('Notification failed (non-fatal):', err));
      }
    } else {
      // APPROVED path: check multi-sig threshold
      const checkApprovalsQuery = `
        WITH claim_info AS (
          SELECT wc.claim_id as id, wc.*, c.chama_name,
                 (SELECT COUNT(*) FROM welfare_claim_approvals 
                  WHERE claim_id = $1 AND status = 'APPROVED') as approval_count
          FROM welfare_claims wc
          JOIN chamas c ON wc.chama_id = c.chama_id
          WHERE wc.claim_id = $1
        )
        SELECT ci.*, 
               (SELECT COUNT(*) FROM chama_members 
                WHERE chama_id = ci.chama_id 
                AND role IN ('CHAIRPERSON', 'SECRETARY', 'TREASURER') 
                AND is_active = true) as total_admins
        FROM claim_info ci
      `;

      const { rows: [claimInfo] } = await client.query(checkApprovalsQuery, [claimId]);

      // Need at least 2 approvals, or all officials have approved (whichever comes first)
      const approvalCount = parseInt(claimInfo.approval_count, 10);
      const totalAdmins = parseInt(claimInfo.total_admins, 10);

      const threshold = Math.min(2, totalAdmins);
      if (approvalCount >= threshold) {
        // --- FINAL FUND INTEGRITY CHECK BEFORE DISBURSEMENT ---
        const { rows: [chama] } = await client.query('SELECT chama_type, current_fund FROM chamas WHERE chama_id = $1', [claimInfo.chama_id]);
        
        let currentBalance = 0;
        if (chama && chama.chama_type === 'WELFARE') {
          currentBalance = parseFloat(chama.current_fund || 0);
        } else {
          const { rows: [fund] } = await client.query('SELECT balance FROM welfare_fund WHERE chama_id = $1', [claimInfo.chama_id]);
          currentBalance = fund ? parseFloat(fund.balance || 0) : 0;
        }

        if (currentBalance < parseFloat(claimInfo.claim_amount)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            message: `Payout failed: Insufficient welfare fund balance (Available: KES ${currentBalance.toLocaleString()}, Needed: KES ${parseFloat(claimInfo.claim_amount).toLocaleString()})`
          });
        }

        // Mark claim as APPROVED
        await client.query(
          "UPDATE welfare_claims SET status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE claim_id = $1",
          [claimId],
        );

        // Process the payout (deducts from fund, records transaction, sets to PAID)
        await processWelfarePayout(claimInfo, client);

        // Notify the claimant
        await sendNotification({
          userId: claimInfo.member_id,
          ...notificationTemplates.welfareClaimApproved(
            claimInfo.chama_name,
            claimInfo.claim_amount,
          ),
          entityId: claimId,
        }).catch(err => logger.warn('Notification failed (non-fatal):', err));
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Approval recorded successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error processing approval:', error);
    res.status(500).json({ message: 'Error processing approval' });
  } finally {
    client.release();
  }
};

// Helper Functions
async function notifyAdminsAboutNewClaim(chamaId, claimId) {
  try {
    // Get claim details and chama name for notification
    const claimQuery = `
      SELECT wc.claim_amount, c.chama_name
      FROM welfare_claims wc
      JOIN chamas c ON wc.chama_id = c.chama_id
      WHERE wc.claim_id = $1
    `;
    const { rows: [claim] } = await pool.query(claimQuery, [claimId]);
    if (!claim) return;

    // Get all official fcm_tokens (Chairperson, Secretary, Treasurer)
    const query = `
      SELECT u.user_id, u.fcm_token
      FROM users u
      JOIN chama_members cm ON u.user_id = cm.user_id
      WHERE cm.chama_id = $1 
      AND cm.role IN ('CHAIRPERSON', 'SECRETARY', 'TREASURER')
      AND cm.is_active = true
      AND u.fcm_token IS NOT NULL
    `;

    const { rows: admins } = await pool.query(query, [chamaId]);

    // Send notification to chama officials
    await sendOfficialNotification(chamaId, {
      ...notificationTemplates.welfareClaimSubmitted(claim.chama_name, claim.claim_amount),
      entityId: claimId,
    });
  } catch (error) {
    logger.error('Error notifying admins:', error);
    // Don't fail the whole operation if notifications fail
  }
}

async function processWelfarePayout(claim, client = pool) {
  try {
    // In a real implementation, this would integrate with M-Pesa API
    // For now, we'll just update the status and log the transaction

    // Record the payout
    await client.query(
      `INSERT INTO transactions (
        chama_id, 
        member_id, 
        amount, 
        transaction_type, 
        reference_id, 
        status, 
        description
      ) VALUES ($1, $2, $3, 'WELFARE_PAYOUT', $4, 'COMPLETED', 'Welfare claim payout')`,
      [claim.chama_id, claim.member_id, claim.claim_amount, claim.id],
    );

    // Update the claim status
    await client.query(
      'UPDATE welfare_claims SET status = \'PAID\', updated_at = CURRENT_TIMESTAMP WHERE claim_id = $1',
      [claim.claim_id || claim.id],
    );

    // Update the correct fund balance based on chama type
    const { rows: [chama] } = await client.query('SELECT chama_type FROM chamas WHERE chama_id = $1', [claim.chama_id]);
    
    if (chama && chama.chama_type === 'WELFARE') {
      await client.query(
        'UPDATE chamas SET current_fund = current_fund - $1 WHERE chama_id = $2',
        [claim.claim_amount, claim.chama_id]
      );
    } else {
      await client.query(
        'UPDATE welfare_fund SET balance = balance - $1 WHERE chama_id = $2',
        [claim.claim_amount, claim.chama_id]
      );
    }

    logger.info(
      `Processed welfare payout of KES ${claim.claim_amount} for claim ${claim.id}`,
    );
  } catch (error) {
    logger.error('Error processing welfare payout:', error);
    // In a real implementation, you'd want to handle this error appropriately
    // and possibly retry or notify an admin
    throw error;
  }
}

// =============================================================================
// EMERGENCY DRIVE (Harambee) – ad-hoc fundraising for a specific member
// =============================================================================

/**
 * Admin creates an Emergency Drive for a member (e.g. a Harambee).
 * Stores a record in welfare_claims with status 'EMERGENCY_DRIVE' that
 * acts as the fundraising campaign record.
 */
const createEmergencyDrive = async (req, res) => {
  const { chamaId } = req.params;
  const { beneficiary_id, description, target_amount } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify beneficiary is a member of the chama
    const memberCheck = await client.query(
      'SELECT user_id FROM chama_members WHERE user_id = $1 AND chama_id = $2 AND is_active = true',
      [beneficiary_id, chamaId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Beneficiary is not an active member of this chama.' });
    }

    // Create the emergency drive record in welfare_emergency_drives table
    const driveRes = await client.query(
      `INSERT INTO welfare_emergency_drives (chama_id, beneficiary_id, description, target_amount, status, created_by)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5)
       RETURNING *`,
      [chamaId, beneficiary_id, description, target_amount, req.user.user_id]
    );
    const drive = driveRes.rows[0];

    // Notify all chama members about the emergency drive
    await sendChamaNotification(chamaId, {
      title: '🆘 Emergency Drive Started',
      body: `A ${description} drive has been started for a fellow member. Please contribute.`,
      entityId: drive.id,
    });

    await client.query('COMMIT');
    return res.status(201).json({ success: true, message: 'Emergency drive created successfully.', data: drive });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating emergency drive:', error);
    return res.status(500).json({ success: false, message: 'Failed to create emergency drive.' });
  } finally {
    client.release();
  }
};

/**
 * List all emergency drives for a chama.
 */
const getEmergencyDrives = async (req, res) => {
  const { chamaId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT d.*, 
              u.first_name || ' ' || u.last_name as beneficiary_name,
              COALESCE(SUM(c.amount), 0) as total_raised,
              COUNT(DISTINCT c.member_id) as contributor_count
       FROM welfare_emergency_drives d
       JOIN users u ON d.beneficiary_id = u.user_id
       LEFT JOIN welfare_emergency_contributions c ON c.drive_id = d.id
       WHERE d.chama_id = $1
       GROUP BY d.id, u.first_name, u.last_name
       ORDER BY d.created_at DESC`,
      [chamaId]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    logger.error('Error fetching emergency drives:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch emergency drives.' });
  }
};

/**
 * Member contributes to an emergency drive.
 */
const contributeToEmergencyDrive = async (req, res) => {
  const { driveId } = req.params;
  const { amount } = req.body;
  const userId = req.user.user_id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Confirm drive exists and is active
    const driveRes = await client.query(
      'SELECT * FROM welfare_emergency_drives WHERE id = $1 AND status = $2',
      [driveId, 'ACTIVE']
    );
    if (driveRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Emergency drive not found or no longer active.' });
    }
    const drive = driveRes.rows[0];

    // Record the contribution
    const contribRes = await client.query(
      `INSERT INTO welfare_emergency_contributions (drive_id, chama_id, member_id, amount)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [driveId, drive.chama_id, userId, amount]
    );

    // Check if target is now met
    const { rows: [totals] } = await client.query(
      'SELECT COALESCE(SUM(amount), 0) as total_raised FROM welfare_emergency_contributions WHERE drive_id = $1',
      [driveId]
    );
    if (parseFloat(totals.total_raised) >= parseFloat(drive.target_amount)) {
      await client.query(
        "UPDATE welfare_emergency_drives SET status = 'COMPLETED' WHERE id = $1",
        [driveId]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({ success: true, message: 'Contribution recorded.', data: contribRes.rows[0] });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error contributing to emergency drive:', error);
    return res.status(500).json({ success: false, message: 'Failed to record contribution.' });
  } finally {
    client.release();
  }
};

module.exports = {
  // Welfare Configuration
  getWelfareConfig,
  updateWelfareConfig,

  // Welfare Fund
  getWelfareFund,
  makeWelfareContribution,

  // Claims
  submitClaim,
  getMemberClaims,
  getChamaClaims,
  approveClaim,

  // Emergency Drives
  createEmergencyDrive,
  getEmergencyDrives,
  contributeToEmergencyDrive,

  // Helper functions (exported for testing)
  _notifyAdminsAboutNewClaim: notifyAdminsAboutNewClaim,
  _processWelfarePayout: processWelfarePayout,
};
