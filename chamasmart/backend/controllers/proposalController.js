const pool = require("../config/db");

// POST /api/asca/:chamaId/proposals
const createProposal = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const { title, description, amount_required, deadline } = req.body;
    const userId = req.user.user_id;

    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const result = await pool.query(
      `INSERT INTO proposals (chama_id, created_by, title, description, amount_required, deadline)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [chamaId, userId, title, description || null, amount_required || null, deadline || null]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// GET /api/asca/:chamaId/proposals
const listProposals = async (req, res, next) => {
  try {
    const { chamaId } = req.params;

    const result = await pool.query(
      `SELECT p.*, 
              u.first_name || ' ' || u.last_name AS creator_name,
              COALESCE(SUM(CASE WHEN v.vote_choice = 'YES' THEN 1 ELSE 0 END), 0) AS yes_votes,
              COALESCE(SUM(CASE WHEN v.vote_choice = 'NO' THEN 1 ELSE 0 END), 0) AS no_votes,
              COALESCE(SUM(CASE WHEN v.vote_choice = 'ABSTAIN' THEN 1 ELSE 0 END), 0) AS abstain_votes
       FROM proposals p
       LEFT JOIN users u ON p.created_by = u.user_id
       LEFT JOIN votes v ON p.id = v.proposal_id
       WHERE p.chama_id = $1
       GROUP BY p.id, u.first_name, u.last_name
       ORDER BY p.created_at DESC NULLS LAST, p.deadline ASC NULLS LAST`,
      [chamaId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
};

// POST /api/asca/proposals/:proposalId/vote
const castVote = async (req, res, next) => {
  try {
    const { proposalId } = req.params;
    const userId = req.user.user_id;
    const { choice } = req.body; // 'YES', 'NO', 'ABSTAIN'

    if (!['YES', 'NO', 'ABSTAIN'].includes(choice)) {
      return res.status(400).json({ success: false, message: 'Invalid vote choice' });
    }

    // Load proposal and its chama for membership validation
    const proposalRes = await pool.query(
      'SELECT id, chama_id, status, deadline FROM proposals WHERE id = $1',
      [proposalId]
    );

    if (proposalRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Proposal not found' });
    }

    const proposal = proposalRes.rows[0];

    // Ensure voter is an active member of the proposal's chama
    const membershipRes = await pool.query(
      `SELECT 1 FROM chama_members
       WHERE chama_id = $1 AND user_id = $2 AND is_active = true`,
      [proposal.chama_id, userId]
    );

    if (membershipRes.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'You are not a member of this chama' });
    }

    if (proposal.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Voting is closed for this proposal' });
    }

    if (proposal.deadline && new Date() > new Date(proposal.deadline)) {
      return res.status(400).json({ success: false, message: 'Voting period has ended' });
    }

    try {
      await pool.query(
        'INSERT INTO votes (proposal_id, user_id, vote_choice) VALUES ($1, $2, $3)',
        [proposalId, userId, choice]
      );
    } catch (err) {
      if (err.code === '23505') {
        return res.status(400).json({ success: false, message: 'You have already voted on this proposal' });
      }
      throw err;
    }

    res.json({ success: true, message: 'Vote cast' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createProposal,
  listProposals,
  castVote,
};
