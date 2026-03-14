/**
 * Fallback: Deterministic Rule-Based Alert Engine
 * Used when Gemini API is unavailable or key is missing.
 */
const generateRuleBasedAlerts = (context) => {
  const { cb, overdueLoans, claims, welfareBal } = context;
  const alerts = [];

  // 1. Critical: Loan Health
  if (cb.loan_score < 40 || overdueLoans[0].count > 0) {
    alerts.push({
      id: "LOAN_RECOVERY",
      severity: "CRITICAL",
      icon: "🚨",
      title: "Loan Default Risk",
      detail: `You have ${overdueLoans[0].count} severely overdue loan(s) totaling KES ${parseFloat(overdueLoans[0].total).toLocaleString()}. This is dragging down your group score.`,
      action: "Initiate guarantor recovery or visit the Loans tab to send reminders."
    });
  }

  // 2. Warning: Welfare Solvency
  const pendingClaims = parseFloat(claims[0].total_pending);
  if (welfareBal < pendingClaims) {
    alerts.push({
      id: "WELFARE_SOLVENCY",
      severity: "WARNING",
      icon: "⚠️",
      title: "Welfare Fund Deficit",
      detail: `Your welfare fund (KES ${parseFloat(welfareBal).toLocaleString()}) is below the pending claim total (KES ${pendingClaims.toLocaleString()}).`,
      action: "Consider a temporary emergency welfare levy or reallocating miscellaneous funds."
    });
  }

  // 3. Tip: Fund Growth
  if (cb.fund_growth_score < 60) {
    alerts.push({
      id: "GROWTH_TIP",
      severity: "TIP",
      icon: "📈",
      title: "Boost Fund Velocity",
      detail: "Your fund growth has plateaued recently compared to member count.",
      action: "Encourage higher individual savings or introduce a short-term ROSCA cycle to boost activity."
    });
  }

  // 4. Tip: Attendance
  if (cb.attendance_score < 70) {
    alerts.push({
      id: "ATTENDANCE_ADVICE",
      severity: "TIP",
      icon: "🤝",
      title: "Engagement Gap",
      detail: "Meeting attendance is dipping, which affects transparency and trust.",
      action: "Enable digital minutes broadcast to keep absent members informed and engaged."
    });
  }

  return alerts;
};

const Groq = require('groq-sdk');
const pool = require('../config/db');
const logger = require('../utils/logger');

const getHealthAlerts = async (req, res, next) => {
  const { chamaId } = req.params;

  try {
    // 1. Ensure cache table exists (using pool.query for auto-client management)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS llm_health_alerts_cache (
        chama_id INTEGER PRIMARY KEY,
        alerts_json JSONB NOT NULL,
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Check for valid cached response
    const cacheRes = await pool.query(
      "SELECT alerts_json FROM llm_health_alerts_cache WHERE chama_id = $1 AND generated_at > NOW() - interval '24 hours'",
      [chamaId]
    );

    if (cacheRes.rows.length > 0) {
      const alerts = cacheRes.rows[0].alerts_json;
      return res.json({
        success: true,
        data: { chamaId: parseInt(chamaId), alertCount: alerts.length, alerts, isCached: true },
      });
    }

    // 3. Gather context
    const { rows: chamaInfo } = await pool.query(
      "SELECT chama_name, chama_type, current_fund FROM chamas WHERE chama_id = $1",
      [chamaId]
    );
    if (!chamaInfo.length) return res.status(404).json({ success: false, message: 'Chama not found' });
    const { chama_name, chama_type, current_fund } = chamaInfo[0];

    const { rows: scoreRows } = await pool.query(
      "SELECT * FROM chama_score_cache WHERE chama_id = $1",
      [chamaId]
    );
    const cb = scoreRows[0] || { 
      composite_score: 70, tier: 'GOOD', contribution_score: 70, 
      loan_score: 70, attendance_score: 70, fund_growth_score: 70, welfare_score: 70 
    };

    const { rows: overdueLoans } = await pool.query(
      "SELECT COUNT(*) as count, COALESCE(SUM(balance), 0) as total FROM loans WHERE chama_id = $1 AND status = 'DISBURSED' AND last_payment_date < NOW() - interval '30 days'",
      [chamaId]
    );
    
    const { rows: claims } = await pool.query(
      "SELECT COALESCE(SUM(claim_amount), 0) as total_pending FROM welfare_claims WHERE chama_id = $1 AND status IN ('SUBMITTED','VERIFIED','APPROVED')",
      [chamaId]
    );

    const { rows: welfareFund } = await pool.query(
      "SELECT balance FROM welfare_fund WHERE chama_id = $1", 
      [chamaId]
    );
    const welfareBal = welfareFund[0]?.balance || 0;

    const context = { chama_name, chama_type, current_fund, cb, overdueLoans, claims, welfareBal };

    // 4. Try Groq
    if (process.env.GROQ_API_KEY) {
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const prompt = `Return a JSON array of 3 actionable financial health alerts for Chama "${chama_name}".
          Context: Score ${cb.composite_score}, Overdue: ${overdueLoans[0].count}, Welfare Bal: ${welfareBal} vs Claims: ${claims[0].total_pending}.
          Format: [{id, severity, icon, title, detail, action}]`;

        const completion = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          response_format: { type: "json_object" }
        });

        let data = JSON.parse(completion.choices[0].message.content);
        const alerts = Array.isArray(data) ? data : (data.alerts || Object.values(data)[0]);

        if (Array.isArray(alerts)) {
          await pool.query(
            "INSERT INTO llm_health_alerts_cache (chama_id, alerts_json, generated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (chama_id) DO UPDATE SET alerts_json = EXCLUDED.alerts_json, generated_at = CURRENT_TIMESTAMP",
            [chamaId, JSON.stringify(alerts)]
          );
          return res.json({ success: true, data: { chamaId: parseInt(chamaId), alertCount: alerts.length, alerts, isCached: false, engine: 'groq' } });
        }
      } catch (err) {
        logger.error('Groq failed', { error: err.message });
      }
    }

    // 5. Fallback
    const fallback = generateRuleBasedAlerts(context);
    return res.json({ success: true, data: { chamaId: parseInt(chamaId), alertCount: fallback.length, alerts: fallback, isCached: false, engine: 'rules' } });

  } catch (err) {
    logger.error('Health alerts error', { err: err.message, chamaId });
    next(err);
  }
};

module.exports = { getHealthAlerts };

