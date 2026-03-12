/**
 * Chama Credit Bureau Controller
 * Computes a 0–100 composite health score for a chama from 5 weighted dimensions:
 *  - Contribution Consistency  30%
 *  - Loan Repayment Health     25%
 *  - Meeting Attendance        15%
 *  - Fund Growth Trend         20%
 *  - Welfare Solvency          10%
 */

const pool = require('../config/db');
const logger = require('../utils/logger');

// ─── Score Tier Helper ────────────────────────────────────────────────────────
function getTier(score) {
  if (score >= 80) return 'EXCELLENT';
  if (score >= 60) return 'GOOD';
  if (score >= 40) return 'FAIR';
  return 'AT_RISK';
}

// ─── Dimension 1: Contribution Consistency (max 100) ─────────────────────────
async function scoreContributions(client, chamaId) {
  try {
    // Look at the last 6 months: what fraction of expected contributions were made?
    const { rows } = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE c.status = 'COMPLETED')::float AS paid,
        COUNT(*)::float AS total
      FROM chama_members cm
      CROSS JOIN generate_series(
        date_trunc('month', NOW() - interval '5 months'),
        date_trunc('month', NOW()),
        interval '1 month'
      ) AS month
      LEFT JOIN contributions c
        ON c.user_id = cm.user_id
        AND c.chama_id = $1
        AND date_trunc('month', c.contribution_date) = month
        AND c.is_deleted = false
      WHERE cm.chama_id = $1 AND cm.is_active = true
    `, [chamaId]);

    const { paid, total } = rows[0];
    if (!total || total === 0) return 70; // No data → neutral score
    return Math.round((paid / total) * 100);
  } catch {
    return 70;
  }
}

// ─── Dimension 2: Loan Repayment Health (max 100) ────────────────────────────
async function scoreLoanHealth(client, chamaId) {
  try {
    const { rows } = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('COMPLETED'))::float AS good,
        COUNT(*) FILTER (WHERE status = 'DEFAULTED')::float AS bad,
        COUNT(*) FILTER (WHERE status IN ('DISBURSED','APPROVED') AND balance > 0)::float AS active,
        COUNT(*)::float AS total
      FROM loans
      WHERE chama_id = $1
    `, [chamaId]);

    const { good, bad, active, total } = rows[0];
    if (!total || total === 0) return 75; // No loans → good standing
    // Penalty for defaults, bonus for completions
    const defaultRate = bad / total;
    const completionRate = good / (total - active || 1);
    const base = Math.max(0, 100 - (defaultRate * 100));
    const bonus = completionRate * 20;
    return Math.min(100, Math.round(base * 0.8 + bonus));
  } catch {
    return 75;
  }
}

// ─── Dimension 3: Meeting Attendance (max 100) ───────────────────────────────
async function scoreAttendance(client, chamaId) {
  try {
    const { rows } = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE ma.status = 'PRESENT')::float AS present,
        COUNT(*)::float AS total
      FROM meetings m
      JOIN chama_members cm ON cm.chama_id = m.chama_id AND cm.is_active = true
      LEFT JOIN meeting_attendance ma
        ON ma.meeting_id = m.meeting_id AND ma.user_id = cm.user_id
      WHERE m.chama_id = $1
        AND m.status = 'COMPLETED'
        AND m.scheduled_date >= NOW() - interval '6 months'
    `, [chamaId]);

    const { present, total } = rows[0];
    if (!total || total === 0) return 70;
    return Math.round((present / total) * 100);
  } catch {
    return 70;
  }
}

// ─── Dimension 4: Fund Growth Trend (max 100) ────────────────────────────────
async function scoreFundGrowth(client, chamaId) {
  try {
    // Compare current fund to 3-months-ago snapshot if available, else from contributions total
    const { rows } = await client.query(`
      SELECT current_fund FROM chamas WHERE chama_id = $1
    `, [chamaId]);
    const currentFund = parseFloat(rows[0]?.current_fund || 0);

    const snap = await client.query(`
      SELECT composite_score FROM chama_health_snapshots
      WHERE chama_id = $1
      ORDER BY snapshot_date DESC
      LIMIT 1
    `, [chamaId]);

    if (snap.rows.length === 0) {
      // First time: base score on whether fund is positive
      return currentFund > 0 ? 75 : 40;
    }

    const prevScore = snap.rows[0].fund_growth_score || 70;
    // Simple heuristic: if fund > 0 give 75+, use prev as anchor
    const base = currentFund > 0 ? Math.min(100, prevScore + 2) : Math.max(30, prevScore - 5);
    return Math.round(base);
  } catch {
    return 70;
  }
}

// ─── Dimension 5: Welfare Solvency (max 100) ─────────────────────────────────
async function scoreWelfareSolvency(client, chamaId) {
  try {
    const { rows } = await client.query(`
      SELECT
        COALESCE((SELECT balance FROM welfare_fund WHERE chama_id = $1), 0) AS fund_balance,
        COALESCE(SUM(claim_amount) FILTER (WHERE status IN ('SUBMITTED','VERIFIED','APPROVED')), 0) AS pending_claims
      FROM welfare_claims
      WHERE chama_id = $1
    `, [chamaId]);

    const { fund_balance, pending_claims } = rows[0];
    const balance = parseFloat(fund_balance);
    const claims = parseFloat(pending_claims);

    if (claims === 0) return balance > 0 ? 85 : 70; // No pending claims = good
    const coverage = balance / claims;
    if (coverage >= 1) return 90;
    if (coverage >= 0.75) return 75;
    if (coverage >= 0.5) return 55;
    if (coverage >= 0.25) return 35;
    return 15;
  } catch {
    return 70;
  }
}

// ─── Main: Compute & Cache Score ─────────────────────────────────────────────
const getChamaScore = async (req, res, next) => {
  const { id: chamaId } = req.params;
  const client = await pool.connect();
  try {
    // Run all 5 dimensions in parallel
    const [c, l, a, f, w] = await Promise.all([
      scoreContributions(client, chamaId),
      scoreLoanHealth(client, chamaId),
      scoreAttendance(client, chamaId),
      scoreFundGrowth(client, chamaId),
      scoreWelfareSolvency(client, chamaId),
    ]);

    // Weighted composite score
    const composite = Math.round(c * 0.30 + l * 0.25 + a * 0.15 + f * 0.20 + w * 0.10);
    const tier = getTier(composite);

    // Upsert into cache
    await client.query(`
      INSERT INTO chama_score_cache
        (chama_id, composite_score, tier,
         contribution_score, loan_score, attendance_score,
         fund_growth_score, welfare_score, computed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
      ON CONFLICT (chama_id) DO UPDATE SET
        composite_score = EXCLUDED.composite_score,
        tier = EXCLUDED.tier,
        contribution_score = EXCLUDED.contribution_score,
        loan_score = EXCLUDED.loan_score,
        attendance_score = EXCLUDED.attendance_score,
        fund_growth_score = EXCLUDED.fund_growth_score,
        welfare_score = EXCLUDED.welfare_score,
        computed_at = NOW()
    `, [chamaId, composite, tier, c, l, a, f, w]);

    // Insert snapshot
    await client.query(`
      INSERT INTO chama_health_snapshots
        (chama_id, composite_score, tier,
         contribution_score, loan_score, attendance_score,
         fund_growth_score, welfare_score, snapshot_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_DATE)
      ON CONFLICT DO NOTHING
    `, [chamaId, composite, tier, c, l, a, f, w]);

    logger.info(`Chama ${chamaId} score computed: ${composite} (${tier})`);

    return res.json({
      success: true,
      data: {
        chamaId: parseInt(chamaId),
        compositeScore: composite,
        tier,
        breakdown: {
          contributions: { score: c, weight: 30, label: 'Contribution Consistency' },
          loans:         { score: l, weight: 25, label: 'Loan Repayment Health' },
          attendance:    { score: a, weight: 15, label: 'Meeting Attendance' },
          fundGrowth:    { score: f, weight: 20, label: 'Fund Growth Trend' },
          welfare:       { score: w, weight: 10, label: 'Welfare Solvency' },
        },
        computedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('getChamaScore error', { err: err.message, chamaId });
    next(err);
  } finally {
    client.release();
  }
};

// ─── Score History (sparkline data) ──────────────────────────────────────────
const getScoreHistory = async (req, res, next) => {
  const { id: chamaId } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT snapshot_date, composite_score, tier
      FROM chama_health_snapshots
      WHERE chama_id = $1
      ORDER BY snapshot_date DESC
      LIMIT 30
    `, [chamaId]);

    return res.json({ success: true, data: rows.reverse() });
  } catch (err) {
    next(err);
  }
};

module.exports = { getChamaScore, getScoreHistory };
