const pool = require("../config/db");
const { sendNotification } = require("../utils/notifications");
const logger = require("../utils/logger");
const { uploadToStorage } = require("../utils/storage");

// Welfare Configuration Management
const getWelfareConfig = async (req, res) => {
  const { chamaId } = req.params;
  try {
    const query = `
      SELECT wc.*, COUNT(wc.id) as active_claims
      FROM welfare_config wc
      LEFT JOIN welfare_claims wcl ON wc.id = wcl.event_type_id 
        AND wcl.status IN ('SUBMITTED', 'VERIFIED', 'APPROVED')
      WHERE wc.chama_id = $1
      GROUP BY wc.id
      ORDER BY wc.event_type
    `;
    const { rows } = await pool.query(query, [chamaId]);
    res.json(rows);
  } catch (error) {
    logger.error("Error fetching welfare config:", error);
    res.status(500).json({ message: "Error fetching welfare configuration" });
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
      WHERE id = $7
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
      return res
        .status(404)
        .json({ message: "Welfare configuration not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    logger.error("Error updating welfare config:", error);
    res.status(500).json({ message: "Error updating welfare configuration" });
  }
};

// Welfare Fund Management
const getWelfareFund = async (req, res) => {
  const { chamaId } = req.params;
  try {
    const query = "SELECT * FROM welfare_fund WHERE chama_id = $1";
    const { rows } = await pool.query(query, [chamaId]);

    if (rows.length === 0) {
      // Initialize fund if it doesn't exist
      const initQuery =
        "INSERT INTO welfare_fund (chama_id, balance) VALUES ($1, 0) RETURNING *";
      const {
        rows: [newFund],
      } = await pool.query(initQuery, [chamaId]);
      return res.json(newFund);
    }

    res.json(rows[0]);
  } catch (error) {
    logger.error("Error fetching welfare fund:", error);
    res.status(500).json({ message: "Error fetching welfare fund" });
  }
};

// Claim Management
const submitClaim = async (req, res) => {
  const { chamaId, memberId } = req.params;
  const { event_type_id, description, date_of_occurrence } = req.body;
  let proof_document_url = null;

  try {
    // Verify the event type exists and is active
    const eventQuery =
      "SELECT * FROM welfare_config WHERE id = $1 AND chama_id = $2 AND is_active = true";
    const {
      rows: [eventType],
    } = await pool.query(eventQuery, [event_type_id, chamaId]);

    if (!eventType) {
      return res
        .status(400)
        .json({ message: "Invalid or inactive event type" });
    }

    // Handle file upload if present
    if (req.file) {
      try {
        proof_document_url = await uploadToStorage(
          req.file,
          `welfare/${chamaId}/claims`
        );
      } catch (uploadError) {
        logger.error("Error uploading document:", uploadError);
        return res.status(500).json({ message: "Error uploading document" });
      }
    }

    // Create the claim
    const query = `
      INSERT INTO welfare_claims 
        (chama_id, member_id, event_type_id, claim_amount, description, date_of_occurrence, proof_document_url, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'SUBMITTED')
      RETURNING *
    `;

    const {
      rows: [claim],
    } = await pool.query(query, [
      chamaId,
      memberId,
      event_type_id,
      eventType.payout_amount,
      description,
      date_of_occurrence,
      proof_document_url,
    ]);

    // Notify admins
    await notifyAdminsAboutNewClaim(chamaId, claim.id);

    res.status(201).json(claim);
  } catch (error) {
    logger.error("Error submitting claim:", error);
    res.status(500).json({ message: "Error submitting claim" });
  }
};

const getMemberClaims = async (req, res) => {
  const { memberId, chamaId } = req.params;

  try {
    const query = `
      SELECT wc.*, wcfg.event_type, wcfg.payout_amount, 
             (SELECT COUNT(*) FROM welfare_claim_approvals wca WHERE wca.claim_id = wc.id) as approval_count
      FROM welfare_claims wc
      JOIN welfare_config wcfg ON wc.event_type_id = wcfg.id
      WHERE wc.member_id = $1 AND wc.chama_id = $2
      ORDER BY wc.created_at DESC
    `;

    const { rows } = await pool.query(query, [memberId, chamaId]);
    res.json(rows);
  } catch (error) {
    logger.error("Error fetching member claims:", error);
    res.status(500).json({ message: "Error fetching claims" });
  }
};

const getChamaClaims = async (req, res) => {
  const { chamaId } = req.params;

  try {
    const query = `
      SELECT wc.*, wcfg.event_type, wcfg.payout_amount,
             u.first_name || ' ' || u.last_name as member_name,
             (SELECT COUNT(*) FROM welfare_claim_approvals wca WHERE wca.claim_id = wc.id) as approval_count
      FROM welfare_claims wc
      JOIN welfare_config wcfg ON wc.event_type_id = wcfg.id
      JOIN users u ON wc.member_id = u.id
      WHERE wc.chama_id = $1
      ORDER BY 
        CASE WHEN wc.status = 'SUBMITTED' THEN 1 ELSE 2 END,
        wc.created_at DESC
    `;

    const { rows } = await pool.query(query, [chamaId]);
    res.json(rows);
  } catch (error) {
    logger.error("Error fetching chama claims:", error);
    res.status(500).json({ message: "Error fetching claims" });
  }
};

// Approval Workflow
const approveClaim = async (req, res) => {
  const { claimId } = req.params;
  const { approverId, status, comments } = req.body;

  try {
    // Start transaction
    await pool.query("BEGIN");

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

    await pool.query(approvalQuery, [claimId, approverId, status, comments]);

    // Check if we have enough approvals
    const checkApprovalsQuery = `
      WITH claim_info AS (
        SELECT wc.*, wc.claim_amount, wc.chama_id, 
               (SELECT COUNT(*) FROM welfare_claim_approvals 
                WHERE claim_id = $1 AND status = 'APPROVED') as approval_count
        FROM welfare_claims wc
        WHERE wc.id = $1
      )
      SELECT ci.*, 
             (SELECT COUNT(*) FROM chama_admins WHERE chama_id = ci.chama_id) as total_admins
      FROM claim_info ci
    `;

    const {
      rows: [claimInfo],
    } = await pool.query(checkApprovalsQuery, [claimId]);

    // If we have at least 2 approvals or this is the last admin to approve
    if (
      claimInfo.approval_count >= 2 ||
      claimInfo.approval_count >= claimInfo.total_admins
    ) {
      // Update claim status to approved
      await pool.query(
        "UPDATE welfare_claims SET status = 'APPROVED' WHERE id = $1",
        [claimId]
      );

      // Process payment (simplified - in reality, you'd integrate with M-Pesa API)
      await processWelfarePayout(claimInfo);

      // Notify the claimant
      await sendNotification({
        userId: claimInfo.member_id,
        title: "Claim Approved",
        message: `Your welfare claim of KES ${claimInfo.claim_amount} has been approved.`,
        type: "WELFARE_CLAIM_UPDATE",
        referenceId: claimId,
      });
    }

    await pool.query("COMMIT");

    res.json({ message: "Approval recorded successfully" });
  } catch (error) {
    await pool.query("ROLLBACK");
    logger.error("Error processing approval:", error);
    res.status(500).json({ message: "Error processing approval" });
  }
};

// Helper Functions
async function notifyAdminsAboutNewClaim(chamaId, claimId) {
  try {
    // Get all admins for this chama
    const query = `
      SELECT u.id, u.fcm_token, u.first_name, u.last_name
      FROM users u
      JOIN chama_admins ca ON u.id = ca.user_id
      WHERE ca.chama_id = $1 AND u.fcm_token IS NOT NULL
    `;

    const { rows: admins } = await pool.query(query, [chamaId]);

    // Send push notification to each admin
    const notificationPromises = admins.map((admin) =>
      sendNotification({
        userId: admin.id,
        title: "New Welfare Claim",
        message: "A new welfare claim requires your approval",
        type: "WELFARE_CLAIM_SUBMITTED",
        referenceId: claimId.toString(),
      })
    );

    await Promise.all(notificationPromises);
  } catch (error) {
    logger.error("Error notifying admins:", error);
    // Don't fail the whole operation if notifications fail
  }
}

async function processWelfarePayout(claim) {
  try {
    // In a real implementation, this would integrate with M-Pesa API
    // For now, we'll just update the status and log the transaction

    // Record the payout
    await pool.query(
      `INSERT INTO transactions (
        chama_id, 
        member_id, 
        amount, 
        transaction_type, 
        reference_id, 
        status, 
        description
      ) VALUES ($1, $2, $3, 'WELFARE_PAYOUT', $4, 'COMPLETED', 'Welfare claim payout')`,
      [claim.chama_id, claim.member_id, claim.claim_amount, claim.id]
    );

    // Update the claim status
    await pool.query(
      "UPDATE welfare_claims SET status = 'PAID', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [claim.id]
    );

    // Update the welfare fund balance
    await pool.query(
      "UPDATE welfare_fund SET balance = balance - $1 WHERE chama_id = $2",
      [claim.claim_amount, claim.chama_id]
    );

    logger.info(
      `Processed welfare payout of KES ${claim.claim_amount} for claim ${claim.id}`
    );
  } catch (error) {
    logger.error("Error processing welfare payout:", error);
    // In a real implementation, you'd want to handle this error appropriately
    // and possibly retry or notify an admin
    throw error;
  }
}

module.exports = {
  // Welfare Configuration
  getWelfareConfig,
  updateWelfareConfig,

  // Welfare Fund
  getWelfareFund,

  // Claims
  submitClaim,
  getMemberClaims,
  getChamaClaims,
  approveClaim,

  // Helper functions (exported for testing)
  _notifyAdminsAboutNewClaim: notifyAdminsAboutNewClaim,
  _processWelfarePayout: processWelfarePayout,
};
