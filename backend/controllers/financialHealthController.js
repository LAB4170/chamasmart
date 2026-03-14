/**
 * Fallback: Deterministic Rule-Based Alert Engine
 * Used when Gemini API is unavailable or key is missing.
 */
const generateRuleBasedAlerts = (context) => {
  const { cb, overdueLoans, claims, welfareBal, stats, liquidityRatio, activeLoansTotal } = context;
  const alerts = [];

  // 1. Critical: Loan Health & Solvency
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

  // 3. Tip: Idle Capital (Over-liquidity)
  if (liquidityRatio > 0.6 && stats.total_members > 5) {
    alerts.push({
      id: "IDLE_CAPITAL",
      severity: "TIP",
      icon: "💰",
      title: "Optimize Idle Capital",
      detail: `Over ${(liquidityRatio * 100).toFixed(0)}% of your fund is sitting idle in the bank.`,
      action: "Encourage members to take more loans or seek low-risk investment opportunities to grow the fund."
    });
  }

  // 4. Growth: Interest Earnings
  if (parseFloat(stats.total_interest_earned) === 0 && activeLoansTotal > 0) {
    alerts.push({
      id: "INTEREST_VELOCITY",
      severity: "TIP",
      icon: "📈",
      title: "Interest Yield Alert",
      detail: "Your loans are active but haven't generated interest income yet.",
      action: "Review your interest rate settings or ensure loan repayments are being recorded correctly."
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

    // Rich Stats from existing logic
    const { rows: statsRows } = await pool.query(
      `SELECT 
         (SELECT COUNT(*) FROM chama_members WHERE chama_id = $1 AND is_active = true) as total_members,
         (SELECT COALESCE(SUM(amount), 0) FROM contributions WHERE chama_id = $1 AND status = 'COMPLETED') as total_savings,
         (SELECT COALESCE(SUM(lr.interest_component), 0) FROM loan_repayments lr JOIN loans l ON lr.loan_id = l.loan_id WHERE l.chama_id = $1) as total_interest_earned,
         (SELECT COALESCE(SUM(balance), 0) FROM loans WHERE chama_id = $1 AND status IN ('DISBURSED', 'ACTIVE', 'DEFAULTED')) as active_loans_total`,
      [chamaId]
    );
    const stats = statsRows[0];

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
      "SELECT COALESCE(balance, 0) as balance FROM welfare_fund WHERE chama_id = $1", 
      [chamaId]
    );
    const welfareBal = welfareFund[0]?.balance || 0;

    // Derived Ratios
    const liquidityRatio = stats.total_savings > 0 ? (current_fund / stats.total_savings) : 0;
    const loanUtilization = (stats.total_savings + stats.total_interest_earned) > 0 
        ? (stats.active_loans_total / (stats.total_savings + stats.total_interest_earned)) 
        : 0;

    const context = { 
        chama_name, chama_type, current_fund, cb, overdueLoans, claims, welfareBal, stats,
        liquidityRatio, loanUtilization, activeLoansTotal: stats.active_loans_total
    };

    // 4. Try AI Engine (Enhanced Prompt)
    if (process.env.GROQ_API_KEY) {
      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const persona = `You are a Senior Financial Advisor for "ChamaSmart", an app for micro-savings groups (Chamas). 
        Analyze the following technical data and provide 3 HIGHLY ACCURATE, ARCHETYPAL alerts.`;

        const prompt = `${persona}
          Chama: ${chama_name} (${chama_type})
          Members: ${stats.total_members}
          Cash in Hand: KES ${current_fund}
          Total Member Savings: KES ${stats.total_savings}
          Liquidity Ratio: ${(liquidityRatio * 100).toFixed(1)}% (Target 20-40%)
          Interest Earned to Date: KES ${stats.total_interest_earned}
          Outstanding Loans: KES ${stats.active_loans_total} (${(loanUtilization * 100).toFixed(1)}% utilization)
          Overdue Loans: ${overdueLoans[0].count} (totaling KES ${overdueLoans[0].total})
          Welfare: Bal KES ${welfareBal} vs Pending Claims KES ${claims[0].total_pending}
          Group Score: ${cb.composite_score}/100

          REQUIREMENTS:
          - Return exactly 3 alerts.
          - 1 "CRITICAL" (if urgent risk exists), 1 "WARNING" (medium risk), 1 "TIP" (opportunity for growth/efficiency).
          - Use professional yet encouraging tone.
          - Format: JSON array of objects with fields: {id, severity, icon, title, detail, action}`;

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

