const pool = require('../config/db');
const logger = require('./logger');

/**
 * AI Security Sentinel
 * Provides anomaly detection and risk scoring for Chama activities.
 */
class AISecurityService {
  /**
   * Scans a transaction or action for risk patterns.
   * Returns a risk score (0-100) and optional flags.
   */
  async analyzeActionRisk(chamaId, userId, actionType, metadata = {}) {
    let baseScore = 0;
    const risks = [];

    try {
      // 1. Check for "Account Drain" anomaly
      if (actionType === 'WITHDRAWAL' || actionType === 'LOAN_DISBURSEMENT') {
        const amount = parseFloat(metadata.amount || 0);
        const { rows: chamaRes } = await pool.query(
          'SELECT current_fund FROM chamas WHERE chama_id = $1',
          [chamaId]
        );
        const currentFund = parseFloat(chamaRes[0]?.current_fund || 0);

        // If trying to withdraw > 50% of total group cash in one go
        if (currentFund > 0 && amount > (currentFund * 0.5)) {
          baseScore += 40;
          risks.push({ code: 'MASSIVE_WITHDRAWAL', detail: 'Attempting to move more than 50% of group liquidity.' });
        }
      }

      // 2. Check for "Sequential Role Change" risk
      if (actionType === 'WITHDRAWAL' || actionType === 'APPROVAL') {
        const { rows: auditRes } = await pool.query(
          `SELECT event_type FROM audit_logs 
           WHERE entity_id = $1 AND entity_type = 'chama' 
           AND created_at > NOW() - interval '24 hours'
           AND event_type = 'ROLE_UPDATED'
           ORDER BY created_at DESC LIMIT 1`,
          [chamaId]
        );

        if (auditRes.length > 0) {
          baseScore += 30;
          risks.push({ code: 'SUSPICIOUS_ROLE_CHANGE', detail: 'Critical financial action immediately followed a role update.' });
        }
      }

      // 3. Check for "Circular Lending" (Fraud)
      if (actionType === 'LOAN_APPLICATION') {
        const { rows: circularRes } = await pool.query(
          `SELECT 1 FROM loans l1
           JOIN loan_repayments lr ON l1.loan_id = lr.loan_id
           WHERE l1.borrower_id = $1 AND l1.chama_id = $2
           AND lr.payer_id != $1
           AND lr.created_at > NOW() - interval '30 days'`,
          [userId, chamaId]
        );

        if (circularRes.length > 0) {
          baseScore += 20;
          risks.push({ code: 'CIRCULAR_REPAYMENT', detail: 'Borrower has history of 3rd party repayments, often a sign of credit cycling.' });
        }
      }

      return {
        isHighRisk: baseScore >= 60,
        score: Math.min(100, baseScore),
        risks,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (logger && logger.error) {
        logger.error('AI Security Analysis Error', { error: error.message, chamaId, userId });
      } else {
        console.error('AI Security Analysis Error', error);
      }
      return { isHighRisk: false, score: 0, risks: [], error: 'Analysis failed' };
    }
  }

  /**
   * Generates a security audit summary for an official.
   */
  async getSecurityPosture(chamaId) {
    const { rows: riskLogs } = await pool.query(
      `SELECT * FROM audit_logs WHERE entity_id = $1 AND severity = 'HIGH' LIMIT 10`,
      [chamaId]
    );

    return {
      chamaId,
      status: riskLogs.length > 3 ? 'ELEVATED' : 'STABLE',
      riskEventCount: riskLogs.length,
      recommendation: riskLogs.length > 3 
        ? 'Enable multi-signature approval for all withdrawals.' 
        : 'Maintain current security protocols.'
    };
  }
}

module.exports = new AISecurityService();
