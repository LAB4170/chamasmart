/**
 * Production-Grade Loan Management System
 * Fixes: Interest calculations, guarantor validation, default detection
 */

const pool = require('../config/db');
const logger = require('../utils/logger');
const { logAuditEvent, EVENT_TYPES, SEVERITY } = require('../utils/auditLog');
const TrustScoreService = require("../utils/trustScoreService");
const { clearChamaCache } = require("../utils/cache");

// Money Utility (Decimal-aware)
const toDecimal = (val) => parseFloat(val);
const fromDecimal = (val) => parseFloat(parseFloat(val).toFixed(2));
const fromDate = (date) => date ? new Date(date).toISOString() : null;

// Currency Helpers
const toCents = (amount) => Math.round(parseFloat(amount) * 100);
const fromCents = (cents) => parseFloat((parseInt(cents || 0) / 100).toFixed(2));

// LOAN INTEREST CALCULATOR

class LoanCalculator {
  /**
   * Calculate flat interest loan schedule
   * @param {number} principal - Loan amount in cents
   * @param {number} interestRate - Annual interest rate (percentage)
   * @param {number} termMonths - Loan term in months
   * @returns {object} Loan schedule
   */
  static calculateFlatInterest(principal, interestRate, termMonths) {
    // Total interest = Principal × Rate × Time (in years)
    const rateDecimal = interestRate / 100;
    const timeInYears = termMonths / 12;
    const totalInterest = Math.round(principal * rateDecimal * timeInYears);
    const totalRepayable = principal + totalInterest;

    // Equal installments
    const monthlyPrincipal = Math.floor(principal / termMonths);
    const monthlyInterest = Math.floor(totalInterest / termMonths);
    const monthlyPayment = monthlyPrincipal + monthlyInterest;

    // Handle rounding errors in last installment
    const installments = [];
    let remainingPrincipal = principal;
    let remainingInterest = totalInterest;

    for (let i = 1; i <= termMonths; i++) {
      const isLastInstallment = i === termMonths;

      const principalPart = isLastInstallment
        ? remainingPrincipal
        : monthlyPrincipal;
      const interestPart = isLastInstallment
        ? remainingInterest
        : monthlyInterest;

      installments.push({
        installmentNumber: i,
        principalAmount: principalPart,
        interestAmount: interestPart,
        totalAmount: principalPart + interestPart,
        balance: remainingPrincipal - principalPart,
      });

      remainingPrincipal -= principalPart;
      remainingInterest -= interestPart;
    }

    return {
      principal,
      totalInterest,
      totalRepayable,
      monthlyPayment,
      installments,
      method: 'FLAT',
    };
  }

  /**
   * Calculate reducing balance interest loan schedule
   * @param {number} principal - Loan amount in cents
   * @param {number} annualInterestRate - Annual interest rate (percentage)
   * @param {number} termMonths - Loan term in months
   * @returns {object} Loan schedule
   */
  static calculateReducingBalance(principal, annualInterestRate, termMonths) {
    const monthlyRate = annualInterestRate / 100 / 12;

    // Calculate EMI (Equated Monthly Installment)
    // EMI = P × r × (1 + r)^n / ((1 + r)^n - 1)
    const emiNumerator = principal * monthlyRate * (1 + monthlyRate) ** termMonths;
    const emiDenominator = (1 + monthlyRate) ** termMonths - 1;
    const emi = Math.round(emiNumerator / emiDenominator);

    const installments = [];
    let balance = principal;
    let totalInterest = 0;

    for (let i = 1; i <= termMonths; i++) {
      const interestPart = Math.round(balance * monthlyRate);
      const principalPart = emi - interestPart;

      // Adjust last installment for rounding errors
      const isLastInstallment = i === termMonths;
      const adjustedPrincipal = isLastInstallment ? balance : principalPart;
      const adjustedTotal = isLastInstallment ? balance + interestPart : emi;

      balance -= adjustedPrincipal;
      totalInterest += interestPart;

      installments.push({
        installmentNumber: i,
        principalAmount: adjustedPrincipal,
        interestAmount: interestPart,
        totalAmount: adjustedTotal,
        balance: Math.max(0, balance), // Ensure no negative balance due to rounding
      });
    }

    return {
      principal,
      totalInterest,
      totalRepayable: principal + totalInterest,
      monthlyPayment: emi,
      installments,
      method: 'REDUCING_BALANCE',
    };
  }

  /**
   * Calculate penalty for late payment
   * @param {number} overdueAmount - Amount overdue in cents
   * @param {number} daysOverdue - Number of days payment is overdue
   * @param {number} penaltyRate - Daily penalty rate (percentage)
   * @returns {number} Penalty amount in cents
   */
  static calculatePenalty(overdueAmount, daysOverdue, penaltyRate = 0.1) {
    // Penalty = Overdue Amount × Daily Rate × Days
    const dailyRate = penaltyRate / 100;
    return Math.round(overdueAmount * dailyRate * daysOverdue);
  }
}

// ============================================================================
// GUARANTOR VALIDATION SERVICE
// ============================================================================

class GuarantorService {
  /**
   * Validate if a user can guarantee a loan
   * @param {object} client - Database client
   * @param {number} chamaId - Chama ID
   * @param {number} guarantorId - Potential guarantor's user ID
   * @param {number} guaranteeAmount - Amount to guarantee in cents
   * @param {number} borrowerId - Borrower's user ID
   * @returns {Promise<object>} Validation result
   */
  static async validate(
    client,
    chamaId,
    guarantorId,
    guaranteeAmount,
    borrowerId,
  ) {
    const errors = [];

    // 1. Cannot guarantee own loan
    if (guarantorId === borrowerId) {
      errors.push('Cannot guarantee your own loan');
      return { valid: false, errors };
    }

    // 2. Check if guarantor is active member
    const memberCheck = await client.query(
      `SELECT total_contributions, is_active 
       FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2`,
      [chamaId, guarantorId],
    );

    if (memberCheck.rows.length === 0 || !memberCheck.rows[0].is_active) {
      errors.push('Guarantor is not an active member of this chama');
      return { valid: false, errors };
    }

    const guarantorSavings = parseFloat(memberCheck.rows[0].total_contributions || 0);

    // 3. Check if guarantor has sufficient savings (at least 50% of guarantee)
    const minSavingsRequired = Math.floor(guaranteeAmount * 0.5);
    if (guarantorSavings < minSavingsRequired) {
      errors.push(
        `Guarantor must have savings of at least ${fromCents(minSavingsRequired)} (50% of guarantee amount)`,
      );
    }

    // 4. Check existing guarantee commitments
    const existingGuarantees = await client.query(
      `SELECT COALESCE(SUM(lg.guarantee_amount), 0) as total_guaranteed
       FROM loan_guarantors lg
       JOIN loans l ON lg.loan_id = l.loan_id
       WHERE lg.guarantor_user_id = $1 
         AND lg.status = 'APPROVED'
         AND l.chama_id = $2
         AND l.status IN ('ACTIVE', 'PENDING_GUARANTOR', 'PENDING_APPROVAL')`,
      [guarantorId, chamaId],
    );

    const totalGuaranteed = parseInt(existingGuarantees.rows[0].total_guaranteed) || 0;

    // 5. Maximum guarantee limit: 3x their savings
    const maxGuaranteeCapacity = guarantorSavings * 3;
    const availableCapacity = maxGuaranteeCapacity - totalGuaranteed;

    if (availableCapacity < guaranteeAmount) {
      errors.push(
        `Guarantor has insufficient guarantee capacity. Available: ${fromCents(availableCapacity)}, Required: ${fromCents(guaranteeAmount)}`,
      );
    }

    // 6. Check if guarantor has defaulted loans
    const defaultedLoans = await client.query(
      `SELECT COUNT(*) as count
       FROM loans
       WHERE borrower_id = $1 
         AND chama_id = $2
         AND status = 'DEFAULTED'`,
      [guarantorId, chamaId],
    );

    if (parseInt(defaultedLoans.rows[0].count) > 0) {
      errors.push(
        'Guarantor has defaulted loans and cannot guarantee new loans',
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      metadata: {
        guarantorSavings: fromDecimal(guarantorSavings),
        totalGuaranteed: fromDecimal(totalGuaranteed),
        availableCapacity: fromDecimal(availableCapacity),
        maxGuaranteeCapacity: fromDecimal(maxGuaranteeCapacity),
      },
    };
  }

  /**
   * Validate all guarantors for a loan
   */
  static async validateAll(
    client,
    chamaId,
    guarantors,
    borrowerId,
    requiredGuarantee,
  ) {
    const results = [];
    let totalValid = 0;

    for (const g of guarantors) {
      const validation = await this.validate(
        client,
        chamaId,
        g.userId,
        g.amount,
        borrowerId,
      );

      results.push({
        userId: g.userId,
        amount: g.amount,
        ...validation,
      });

      if (validation.valid) {
        totalValid += g.amount;
      }
    }

    const allValid = results.every(r => r.valid);
    const sufficientCoverage = totalValid >= requiredGuarantee;

    return {
      valid: allValid && sufficientCoverage,
      guarantors: results,
      totalValid: fromDecimal(totalValid),
      requiredGuarantee: fromDecimal(requiredGuarantee),
      coverage: totalValid / requiredGuarantee,
    };
  }
}

// ============================================================================
// LOAN DEFAULT DETECTION (Background Job)
// ============================================================================

class DefaultDetector {
  /**
   * Check and mark overdue loans as defaulted
   * Should run daily via cron job
   */
  static async detectDefaults() {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Find loans with overdue installments (30+ days)
      // Standardized to status DISBURSED and table loan_schedules
      const result = await client.query(`
        SELECT DISTINCT l.loan_id, l.chama_id, l.borrower_id, l.loan_amount,
               u.first_name || ' ' || u.last_name as borrower_name
        FROM loans l
        JOIN users u ON l.borrower_id = u.user_id
        JOIN loan_schedules ls ON l.loan_id = ls.loan_id
        WHERE l.status IN ('ACTIVE', 'DISBURSED')
          AND ls.status = 'PENDING'
          AND ls.due_date < CURRENT_DATE - INTERVAL '30 days'
      `);

      for (const loan of result.rows) {
        // Mark as defaulted
        await client.query(
          `UPDATE loans 
           SET status = 'DEFAULTED', 
               defaulted_at = NOW()
           WHERE loan_id = $1`,
          [loan.loan_id],
        );

        // Notify Borrower
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, related_id)
           VALUES ($1, 'LOAN_DEFAULTED', 'Loan Defaulted', 
                   'Critical: Your loan has been marked as defaulted due to being 30+ days overdue. Guarantors may be contacted for recovery.', $2)`,
          [loan.borrower_id, loan.loan_id],
        );

        // Notify ALL Approved Guarantors
        const guarantors = await client.query(
          `SELECT guarantor_user_id FROM loan_guarantors 
           WHERE loan_id = $1 AND status = 'APPROVED'`,
          [loan.loan_id]
        );

        for (const g of guarantors.rows) {
          await client.query(
            `INSERT INTO notifications (user_id, type, title, message, related_id)
             VALUES ($1, 'GUARANTOR_LIABILITY', 'Action Required: Guaranteed Loan Defaulted', 
                     'A loan you guaranteed for ${loan.borrower_name} has officially DEFAULTED. As a guarantor, you are now authorized and requested to settle the balance.', $2)`,
            [g.guarantor_user_id, loan.loan_id]
          );
        }

        // Notify Chama Officials
        const officials = await client.query(
          `SELECT user_id FROM chama_members 
           WHERE chama_id = $1 AND role IN ('TREASURER', 'CHAIRPERSON')`,
          [loan.chama_id],
        );

        for (const official of officials.rows) {
          await client.query(
            `INSERT INTO notifications (user_id, type, title, message, related_id)
             VALUES ($1, 'LOAN_DEFAULTED', 'Member Defaulted', 
                     'System Alert: ${loan.borrower_name} has defaulted on their loan. Recovery procedures including guarantor notifications have been initiated.', $2)`,
            [official.user_id, loan.loan_id],
          );
        }

        logger.info('Loan marked as defaulted', {
          loanId: loan.loan_id,
          chamaId: loan.chama_id,
          borrowerId: loan.borrower_id,
        });
      }

      await client.query('COMMIT');

      return {
        processed: result.rows.length,
        defaults: result.rows.map(r => r.loan_id),
      };
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      logger.error('DefaultDetector.detectDefaults error:', error.message);
      throw error;
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Calculate and apply penalties for overdue installments
   */
  static async applyPenalties() {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Find overdue installments
      const result = await client.query(`
        SELECT li.*, l.chama_id
        FROM loan_installments li
        JOIN loans l ON li.loan_id = l.loan_id
        WHERE li.status = 'PENDING'
          AND li.due_date < CURRENT_DATE
          AND l.status = 'ACTIVE'
      `);

      for (const installment of result.rows) {
        const daysOverdue = Math.floor(
          (Date.now() - new Date(installment.due_date).getTime())
          / (1000 * 60 * 60 * 24),
        );

        // Get chama's penalty configuration
        const configResult = await client.query(
          'SELECT constitution_config FROM chamas WHERE chama_id = $1',
          [installment.chama_id],
        );

        const config = configResult.rows[0]?.constitution_config?.loan || {};
        const penaltyRate = config.daily_penalty_rate || 0.1; // Default 0.1% per day

        const penalty = LoanCalculator.calculatePenalty(
          installment.amount,
          daysOverdue,
          penaltyRate,
        );

        // Update installment with penalty
        await client.query(
          `UPDATE loan_installments 
           SET penalty_amount = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [penalty, installment.id],
        );

        // Update loan's total penalty
        await client.query(
          `UPDATE loans 
           SET penalty_outstanding = penalty_outstanding + $1
           WHERE loan_id = $2`,
          [penalty, installment.loan_id],
        );
      }

      await client.query('COMMIT');

      return {
        processed: result.rows.length,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.logError(error, { context: 'DefaultDetector.applyPenalties' });
      throw error;
    } finally {
      client.release();
    }
  }
}

// ============================================================================
// IMMUTABLE LOAN CONFIGURATION
// ============================================================================

class LoanConfigService {
  /**
   * Update loan configuration for NEW loans only
   * Existing loans maintain their original config
   */
  static async updateConfig(chamaId, newConfig) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get current config
      const result = await client.query(
        'SELECT constitution_config FROM chamas WHERE chama_id = $1 FOR UPDATE',
        [chamaId],
      );

      const currentConfig = result.rows[0]?.constitution_config || {};

      // Create versioned config
      const version = (currentConfig.loan?.version || 0) + 1;
      const updatedLoanConfig = {
        ...currentConfig.loan,
        ...newConfig,
        version,
        effectiveFrom: new Date().toISOString(),
      };

      const updatedConfig = {
        ...currentConfig,
        loan: updatedLoanConfig,
      };

      await client.query(
        'UPDATE chamas SET constitution_config = $1 WHERE chama_id = $2',
        [updatedConfig, chamaId],
      );

      // Log configuration change
      await client.query(
        `INSERT INTO config_history (chama_id, config_type, old_config, new_config, version)
         VALUES ($1, 'loan', $2, $3, $4)`,
        [chamaId, currentConfig.loan, updatedLoanConfig, version],
      );

      await client.query('COMMIT');

      return {
        version,
        config: updatedLoanConfig,
        effectiveFrom: updatedLoanConfig.effectiveFrom,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get effective config for a specific date (for existing loans)
   */
  static async getEffectiveConfig(chamaId, effectiveDate) {
    const result = await pool.query(
      `SELECT new_config 
       FROM config_history 
       WHERE chama_id = $1 
         AND config_type = 'loan'
         AND created_at <= $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [chamaId, effectiveDate],
    );

    return result.rows[0]?.new_config || null;
  }
}

// ============================================================================
// TREASURY LIQUIDITY HELPER
// ============================================================================
// ============================================================================
// TREASURY LIQUIDITY HELPER
// ============================================================================
const getAvailableTreasury = async (client, chamaId, chamaType) => {
  let availablePool = 0;

  if (chamaType === 'ASCA') {
    const cycleRes = await client.query(
      "SELECT cycle_id FROM asca_cycles WHERE chama_id = $1 AND status = 'ACTIVE'",
      [chamaId]
    );
    if (cycleRes.rows.length === 0) return 0;
    const cycleId = cycleRes.rows[0].cycle_id;

    const investRes = await client.query(
      "SELECT SUM(total_investment) as total_pool FROM asca_members WHERE cycle_id = $1",
      [cycleId]
    );
    const totalPool = parseFloat(investRes.rows[0].total_pool || 0);

    const outRes = await client.query(
      `SELECT SUM(CASE WHEN l.status = 'DISBURSED' THEN l.balance ELSE l.loan_amount END) as disbursed 
       FROM loans l
       JOIN asca_members am ON l.borrower_id = am.user_id AND am.cycle_id = $1
       WHERE l.chama_id = $2 AND l.status IN ('DISBURSED', 'APPROVED', 'PENDING', 'PENDING_GUARANTOR', 'PENDING_APPROVAL')`,
      [cycleId, chamaId]
    );
    const totalDisbursed = parseFloat(outRes.rows[0].disbursed || 0);
    availablePool = Math.max(0, totalPool - totalDisbursed);

  } else {
    const contRes = await client.query(
      "SELECT SUM(total_contributions) as total_pool FROM chama_members WHERE chama_id = $1 AND is_active = true",
      [chamaId]
    );
    const totalPool = parseFloat(contRes.rows[0].total_pool || 0);

    const outRes = await client.query(
      `SELECT SUM(CASE WHEN status = 'DISBURSED' THEN balance ELSE loan_amount END) as disbursed 
       FROM loans 
       WHERE chama_id = $1 AND status IN ('DISBURSED', 'APPROVED', 'PENDING', 'PENDING_GUARANTOR', 'PENDING_APPROVAL')`,
      [chamaId]
    );
    const totalDisbursed = parseFloat(outRes.rows[0].disbursed || 0);
    availablePool = Math.max(0, totalPool - totalDisbursed);
  }

  return availablePool;
};

// ============================================================================
// REFACTORED LOAN APPLICATION WITH VALIDATIONS
// ============================================================================

const applyForLoan = async (req, res) => {
  const client = await pool.connect();

  try {
    const { chamaId } = req.params;
    const {
      amount, purpose, termMonths: rawTermMonths, repaymentPeriod, guarantors,
    } = req.body;
    const termMonths = repaymentPeriod || rawTermMonths;
    const userId = req.user.user_id;

    // === VALIDATION ===
    if (!amount || !termMonths) {
      return res.status(400).json({
        success: false,
        message: 'Amount and term are required',
      });
    }

    const amountValueCents = toCents(amount);
    const term = parseInt(termMonths, 10);

    if (amountValueCents <= 0 || term <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount or term',
      });
    }

    await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');

    // === GET CHAMA CONFIG ===
    const chamaRes = await client.query(
      `SELECT chama_type, constitution_config 
       FROM chamas 
       WHERE chama_id = $1 AND is_active = true`,
      [chamaId],
    );

    if (chamaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Chama not found',
      });
    }

    const chama = chamaRes.rows[0];

    if (!['TABLE_BANKING', 'ASCA'].includes(chama.chama_type)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'This chama is not configured for loans',
      });
    }

    // Get current loan config (will be frozen for this loan)
    const loanConfig = chama.constitution_config?.loan || {
      interest_rate: 10,
      interest_type: 'FLAT',
      loan_multiplier: 3,
      max_repayment_months: 6,
    };

    // === CHECK ELIGIBILITY ===
    let savings = 0;

    if (chama.chama_type === 'ASCA') {
      const cycleRes = await client.query(
        "SELECT cycle_id FROM asca_cycles WHERE chama_id = $1 AND status = 'ACTIVE'",
        [chamaId]
      );
      if (cycleRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'No active ASCA cycle found.' });
      }
      
      const ascaMember = await client.query(
        'SELECT total_investment FROM asca_members WHERE cycle_id = $1 AND user_id = $2',
        [cycleRes.rows[0].cycle_id, userId]
      );
      if (ascaMember.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ success: false, message: 'You are not an active ASCA member.' });
      }
      savings = parseFloat(ascaMember.rows[0].total_investment || 0);
    } else {
      const memberRes = await client.query(
        `SELECT total_contributions 
         FROM chama_members 
         WHERE chama_id = $1 AND user_id = $2 AND is_active = true`,
        [chamaId, userId],
      );

      if (memberRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          success: false,
          message: 'You are not an active member',
        });
      }

      savings = parseFloat(memberRes.rows[0].total_contributions || 0);
    }

    // === ELIGIBILITY HARDENING ===
    if (savings <= 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Constitutional Requirement: You must have active contributions to apply for a loan.',
      });
    }

    // Check for defaults
    const defaultCheck = await client.query(
      `SELECT COUNT(*) as count 
       FROM loans 
       WHERE borrower_id = $1 AND status = 'DEFAULTED'`,
      [userId],
    );

    if (parseInt(defaultCheck.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'You have defaulted loans',
      });
    }

    // === CALCULATE LOAN ELIGIBILITY ===
    const maxLoan = chama.chama_type === 'ASCA' ? savings * 3 : savings * loanConfig.loan_multiplier;

    // Check outstanding loans
    const outstandingRes = await client.query(
      `SELECT 
         COALESCE(SUM(balance), 0) as balance
       FROM loans
       WHERE borrower_id = $1 
         AND chama_id = $2
         AND status IN ('DISBURSED', 'APPROVED', 'PENDING')`,
      [userId, chamaId],
    );

    const outstandingCents = toCents(outstandingRes.rows[0].balance || 0);
    const availableCreditCents = maxLoanCents - outstandingCents;

    if (amountValueCents > availableCreditCents) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: chama.chama_type === 'ASCA' ? 'ASCA Loan Limit Exceeded.' : 'Requested amount exceeds your loan limit',
        data: {
          requestedAmount: fromCents(amountValueCents),
          availableCredit: fromCents(availableCreditCents),
          maxLoan: fromCents(maxLoanCents),
          outstandingLoans: fromCents(outstandingCents),
          savings: fromCents(savingsCents),
        },
      });
    }

    // === VALIDATE TREASURY LIQUIDITY ===
    const availablePool = await getAvailableTreasury(client, chamaId, chama.chama_type);
    
    if (amountValue > availablePool) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Insufficient Chama Treasury: The requested amount exceeds the unallocated funds currently available in the Chama pool.',
        data: {
          requestedAmount: fromDecimal(amountValue),
          availablePool: fromDecimal(availablePool),
        },
      });
    }

    // === VALIDATE GUARANTORS ===
    const requiredGuarantee = Math.max(0, amountValue - savings);
    let guarantorArray = Array.isArray(guarantors) ? guarantors : [];

    // Map guarantor amounts - handle both integer arrays and object arrays
    guarantorArray = guarantorArray.map(g => {
      if (typeof g === 'object' && g !== null && g.userId) {
        return { userId: g.userId, amount: parseFloat(g.amount) };
      }
      // Simple integer user ID
      return { userId: parseInt(g, 10), amount: amountValue };
    });

    if (requiredGuarantee > 0) {
      const validation = await GuarantorService.validateAll(
        client,
        chamaId,
        guarantorArray, 
        userId,
        requiredGuarantee,
      );

      if (!validation.valid) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Guarantor validation failed',
          errors: validation.guarantors ? validation.guarantors.flatMap(g => g.errors || []) : [],
          guarantors: validation.guarantors,
        });
      }
    }

    // === CALCULATE LOAN SCHEDULE ===
    const schedule = loanConfig.interest_type === 'REDUCING_BALANCE'
      ? LoanCalculator.calculateReducingBalance(
        amountValueCents,
        loanConfig.interest_rate,
        term,
      )
      : LoanCalculator.calculateFlatInterest(
        amountValueCents,
        loanConfig.interest_rate,
        term,
      );

    // === CREATE LOAN ===
    const loanResult = await client.query(
      `INSERT INTO loans (
        chama_id, borrower_id, loan_amount, 
        interest_rate, total_repayable,
        term_months, status, purpose,
        monthly_payment, next_payment_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING *`,
      [
        chamaId,
        userId,
        fromCents(amountValueCents),
        loanConfig.interest_rate,
        fromCents(schedule.totalRepayable),
        term,
        'PENDING',
        purpose,
        fromCents(schedule.monthlyPayment),
        schedule.installments[0]?.dueDate || new Date(new Date().setMonth(new Date().getMonth() + 1))
      ],
    );

    const loan = loanResult.rows[0];

    // === CREATE GUARANTOR RECORDS ===
    if (guarantorArray.length > 0) {
      for (const g of guarantorArray) {
        await client.query(
          `INSERT INTO loan_guarantors (loan_id, guarantor_user_id, guarantee_amount, status)
           VALUES ($1, $2, $3, 'PENDING')`,
          [loan.loan_id, g.userId, g.amount],
        );

        // Notify guarantor
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
           VALUES ($1, 'LOAN_GUARANTEE_REQUEST', 'Guarantee Request', 
                   'You have been requested to guarantee a loan', 'LOAN', $2)`,
          [g.userId, loan.loan_id],
        );
      }
    }

    await client.query('COMMIT');

    // Invalidate stats cache
    clearChamaCache(chamaId);

    logger.logSecurityEvent('Loan application created', {
      loanId: loan.loan_id,
      chamaId,
      borrowerId: userId,
      amount: fromDecimal(amountValue),
    });

    return res.status(201).json({
      success: true,
      message: 'Loan application submitted successfully',
      data: {
        loan: {
          ...loan,
          loan_amount: fromDecimal(loan.loan_amount),
          total_repayable: fromDecimal(loan.total_repayable),
        },
        schedule: {
          ...schedule,
          principal: fromDecimal(schedule.principal),
          totalInterest: fromDecimal(schedule.totalInterest),
          totalRepayable: fromDecimal(schedule.totalRepayable),
          monthlyPayment: fromDecimal(schedule.monthlyPayment),
          installments: schedule.installments.map(inst => ({
            ...inst,
            principalAmount: fromDecimal(inst.principalAmount),
            interestAmount: fromDecimal(inst.interestAmount),
            totalAmount: fromDecimal(inst.totalAmount),
            balance: fromDecimal(inst.balance),
          })),
        },
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.logError(error, { context: 'applyForLoan' });
    console.error("LOAN APPLY 500:", error);

    return res.status(500).json({
      success: false,
      message: 'Error applying for loan',
    });
  } finally {
    client.release();
  }
};

// ============================================================================
// ADDITIONAL LOAN MANAGEMENT FUNCTIONS
// ============================================================================

// @desc    Get all loans for a chama
// @route   GET /api/loans/:chamaId
// @access  Private
const getChamaLoans = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE l.chama_id = $1';
    const params = [chamaId];

    if (status) {
      whereClause += ' AND l.status = $2';
      params.push(status);
    }

    const result = await pool.query(
      `SELECT 
        l.*,
        l.next_payment_at as due_date,
        u.first_name || ' ' || u.last_name as borrower_name,
        u.email as borrower_email,
        m.role as borrower_role,
        (l.borrower_id = $${params.length + 3}) as is_borrower,
        EXISTS (
          SELECT 1 FROM loan_guarantors 
          WHERE loan_id = l.loan_id 
          AND guarantor_user_id = $${params.length + 3} 
          AND status = 'APPROVED'
        ) as is_guarantor
       FROM loans l
       JOIN users u ON l.borrower_id = u.user_id
       JOIN chama_members m ON l.borrower_id = m.user_id AND m.chama_id = l.chama_id
       ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset, req.user.user_id],
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM loans l ${whereClause}`,
      params,
    );

    const loans = result.rows.map(loan => ({
      ...loan,
      loan_amount: fromDecimal(loan.loan_amount),
      total_repayable: fromDecimal(loan.total_repayable),
      amount_paid: fromDecimal(loan.amount_paid),
      balance: fromDecimal(loan.balance),
    }));

    res.json({
      success: true,
      data: {
        loans,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get chama loans error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving loans',
    });
  }
};

// @desc    Get loan details by ID
// @route   GET /api/loans/:chamaId/:loanId
// @access  Private
const getLoanById = async (req, res) => {
  try {
    const { chamaId, loanId } = req.params;

    const result = await pool.query(
      `SELECT 
        l.*,
        l.next_payment_at as due_date,
        u.first_name || ' ' || u.last_name as borrower_name,
        u.email as borrower_email,
        m.role as borrower_role
       FROM loans l
       JOIN users u ON l.borrower_id = u.user_id
       JOIN chama_members m ON l.borrower_id = m.user_id AND m.chama_id = l.chama_id
       WHERE l.loan_id = $1 AND l.chama_id = $2`,
      [loanId, chamaId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found',
      });
    }

    const loan = {
      ...result.rows[0],
      loan_amount: fromDecimal(result.rows[0].loan_amount),
      total_repayable: fromDecimal(result.rows[0].total_repayable),
      amount_paid: fromDecimal(result.rows[0].amount_paid),
      balance: fromDecimal(result.rows[0].balance),
    };

    // Get loan schedule
    const scheduleResult = await pool.query(
      'SELECT * FROM loan_schedules WHERE loan_id = $1 ORDER BY installment_number',
      [loanId],
    );

    const schedule = scheduleResult.rows.map(installment => ({
      ...installment,
      principal_amount: fromDecimal(installment.principal_amount),
      interest_amount: fromDecimal(installment.interest_amount),
      total_amount: fromDecimal(installment.total_amount),
      balance: fromDecimal(installment.balance),
    }));

    // Get guarantors
    const guarantorsResult = await pool.query(
      `SELECT 
        lg.*,
        u.first_name,
        u.last_name,
        u.first_name || ' ' || u.last_name as guarantor_name,
        u.email as guarantor_email
       FROM loan_guarantors lg
       JOIN users u ON lg.guarantor_user_id = u.user_id
       WHERE lg.loan_id = $1`,
      [loanId],
    );

    const guarantors = guarantorsResult.rows.map(guarantor => ({
      ...guarantor,
      guarantee_amount: fromDecimal(guarantor.guarantee_amount),
    }));

    // Get repayments
    const repaymentsResult = await pool.query(
      'SELECT * FROM loan_repayments WHERE loan_id = $1 ORDER BY payment_date DESC',
      [loanId],
    );

    const repayments = repaymentsResult.rows.map(repayment => ({
      ...repayment,
      amount: fromDecimal(repayment.amount),
    }));

    res.json({
      success: true,
      data: {
        loan,
        schedule,
        guarantors,
        repayments,
      },
    });
  } catch (error) {
    console.error('Get loan by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving loan details',
    });
  }
};

// @desc    Approve loan application
// @route   PUT /api/loans/:chamaId/:loanId/approve
// @access  Private (Officials only)
const approveLoan = async (req, res) => {
  const client = await pool.connect();

  try {
    // ENFORCE SERIALIZABLE TO PREVENT RACE CONDITIONS DURING SIMULTANEOUS APPROVALS
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');

    const { chamaId, loanId } = req.params;
    const {
      approvedAmount, interestRate, termMonths, notes,
    } = req.body || {};
    const userId = req.user.user_id;

    // Check if user is authorized
    const memberCheck = await client.query(
      'SELECT role FROM chama_members WHERE user_id = $1 AND chama_id = $2',
      [userId, chamaId],
    );

    if (
      memberCheck.rows.length === 0
      || !['CHAIRPERSON', 'TREASURER', 'ADMIN'].includes(memberCheck.rows[0].role)
    ) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Not authorized to approve loans',
      });
    }

    // Get loan details
    const loanResult = await client.query(
      "SELECT * FROM loans WHERE loan_id = $1 AND chama_id = $2",
      [loanId, chamaId],
    );

    if (loanResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Loan not found',
      });
    }

    const loan = loanResult.rows[0];

    // If already approved, return success (Idempotency)
    if (loan.status === 'APPROVED') {
      await client.query('ROLLBACK');
      return res.json({
        success: true,
        message: 'Loan is already approved',
        data: loan
      });
    }

    if (loan.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Loan cannot be approved in its current status: ${loan.status}`,
      });
    }

    // SECURITY: Officials cannot approve their own loans
    if (loan.borrower_id === userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Security Violation: Officials cannot approve their own loan applications. Please have another authorized official review this.',
      });
    }

    // Check if all guarantors have accepted
    const pendingGuarantors = await client.query(
      "SELECT COUNT(*) FROM loan_guarantors WHERE loan_id = $1 AND status != 'APPROVED'",
      [loanId]
    );

    if (parseInt(pendingGuarantors.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'All guarantors must explicitly accept the request before official approval.',
      });
    }
    const approvedAmountCents = toCents(approvedAmount || fromDecimal(loan.loan_amount));

    // === VALIDATE TREASURY LIQUIDITY ===
    const chamaRes = await client.query('SELECT chama_type FROM chamas WHERE chama_id = $1', [chamaId]);
    const chamaType = chamaRes.rows[0].chama_type;
    const availablePoolCents = toCents(await getAvailableTreasury(client, chamaId, chamaType));
    
    // Add back the current loan amount because it was already deducted by getAvailableTreasury as a pending liability
    const effectivePoolCents = availablePoolCents + toCents(loan.loan_amount || 0);

    if (approvedAmountCents > effectivePoolCents) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Approval Failed: The requested amount exceeds the unallocated funds currently available in the Chama pool.',
        data: {
          approvedAmount: fromCents(approvedAmountCents),
          availablePool: fromCents(effectivePoolCents),
        },
      });
    }

    const finalInterestRate = parseFloat(interestRate || loan.interest_rate);
    const finalTermMonths = parseInt(termMonths || loan.term_months, 10);

    // Calculate schedule
    const schedule = LoanCalculator.calculateFlatInterest(
      approvedAmountCents,
      finalInterestRate,
      finalTermMonths,
    );

    // Update loan and deduct from chama fund (Fix Double Recovery Bug)
    await client.query(
      `UPDATE loans 
       SET status = 'APPROVED',
           approved_amount = $1,
           interest_rate = $2,
           term_months = $3,
           total_repayable = $4,
           approved_by = $5,
           approved_at = NOW(),
           approval_notes = $6,
           next_payment_at = $7
       WHERE loan_id = $8`,
      [
        fromCents(approvedAmountCents),
        finalInterestRate,
        finalTermMonths,
        fromCents(schedule.totalRepayable),
        userId,
        notes,
        schedule.installments[0]?.dueDate || new Date(new Date().setMonth(new Date().getMonth() + 1)),
        loanId,
      ],
    );

    // CRITICAL: Deduct the approved amount from the chama's current fund to prevent "Double Recovery" inflation
    await client.query(
      'UPDATE chamas SET current_fund = current_fund - $1 WHERE chama_id = $2',
      [fromCents(approvedAmountCents), chamaId]
    );

    // Create loan schedule
    // First, clean up any existing draft/pending schedules for this loan
    await client.query('DELETE FROM loan_schedules WHERE loan_id = $1', [loanId]);

    const approvalDate = new Date();
    for (const installment of schedule.installments) {
      // Generate due dates starting 1 month from approval
      const dueDate = new Date(approvalDate);
      dueDate.setMonth(approvalDate.getMonth() + installment.installmentNumber);

      await client.query(
        `INSERT INTO loan_schedules 
         (loan_id, installment_number, principal_amount, interest_amount, total_amount, balance, due_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')`,
        [
          loanId,
          installment.installmentNumber,
          installment.principalAmount,
          installment.interestAmount,
          installment.totalAmount,
          installment.balance,
          dueDate,
        ],
      );
    }

    await client.query('COMMIT');

    await logAuditEvent({
      eventType: EVENT_TYPES.LOAN_APPROVED,
      userId,
      action: 'Approved loan application',
      entityType: 'loan',
      entityId: loanId,
      metadata: {
        chamaId,
        borrowerId: loan.borrower_id,
        approvedAmount,
        interestRate,
        termMonths,
      },
      severity: SEVERITY.HIGH,
    });

    // Invalidate stats cache since funds have moved
    clearChamaCache(chamaId);

    res.json({
      success: true,
      message: 'Loan approved successfully',
      data: {
        loanId,
        approvedAmount,
        totalRepayable: fromDecimal(schedule.totalRepayable),
        monthlyPayment: fromDecimal(schedule.monthlyPayment),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Approve loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving loan',
    });
  } finally {
    client.release();
  }
};

// @desc    Reject loan application
// @route   PUT /api/loans/:chamaId/:loanId/reject
// @access  Private (Officials only)
const rejectLoan = async (req, res) => {
  try {
    const { chamaId, loanId } = req.params;
    const { reason } = req.body || {};
    const userId = req.user.user_id;

    // Check if user is authorized
    const memberCheck = await pool.query(
      'SELECT role FROM chama_members WHERE user_id = $1 AND chama_id = $2',
      [userId, chamaId],
    );

    if (
      memberCheck.rows.length === 0
      || !['CHAIRPERSON', 'TREASURER', 'ADMIN'].includes(memberCheck.rows[0].role)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reject loans',
      });
    }

    // Update loan
    const result = await pool.query(
      `UPDATE loans 
       SET status = 'REJECTED',
           rejected_by = $1,
           rejected_at = NOW(),
           rejection_reason = $2
       WHERE loan_id = $3 AND chama_id = $4 AND status = 'PENDING'
       RETURNING *`,
      [userId, reason, loanId, chamaId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Loan not found or already processed',
      });
    }

    await logAuditEvent({
      eventType: EVENT_TYPES.LOAN_REJECTED,
      userId,
      action: 'Rejected loan application',
      entityType: 'loan',
      entityId: loanId,
      metadata: {
        chamaId,
        borrowerId: result.rows[0].borrower_id,
        reason,
      },
      severity: SEVERITY.MEDIUM,
    });

    res.json({
      success: true,
      message: 'Loan rejected successfully',
    });
  } catch (error) {
    console.error('Reject loan error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting loan',
    });
  }
};

// @desc    Make loan repayment
// @route   POST /api/loans/:chamaId/:loanId/repay
// @access  Private
const makeRepayment = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const chamaId = parseInt(req.params.chamaId, 10);
    const loanId = parseInt(req.params.loanId, 10);
    const { amount, paymentMethod = 'cash', notes } = req.body;
    const userId = req.user.user_id;

    if (isNaN(chamaId) || isNaN(loanId)) {
        throw new Error('Invalid Chama or Loan ID format');
    }

    const repaymentAmountCents = toCents(amount);

    // Get loan details - allow repayment if APPROVED, DISBURSED, or DEFAULTED
    const loanResult = await client.query(
      `SELECT * FROM loans 
       WHERE loan_id = $1 AND chama_id = $2 
       AND status IN ('APPROVED', 'DISBURSED', 'DEFAULTED')`,
      [loanId, chamaId],
    );

    if (loanResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Loan not found or not in repayable status (must be Approved, Disbursed, or Defaulted)',
      });
    }

    const loan = loanResult.rows[0];

    // SECURITY: Only borrower or a guarantor can repay
    const guarantorCheck = await client.query(
        "SELECT 1 FROM loan_guarantors WHERE loan_id = $1 AND guarantor_user_id = $2 AND status = 'APPROVED'",
        [loanId, userId]
    );
    const isBorrower = loan.borrower_id === userId;
    const isGuarantor = guarantorCheck.rowCount > 0;

    if (!isBorrower && !isGuarantor) {
        await client.query('ROLLBACK');
        return res.status(403).json({
            success: false,
            message: 'Not authorized: Only the borrower or an approved guarantor can make repayments on this loan.'
        });
    }

    // GUARANTOR RESTRICTION: Guarantors can only pay if the loan is DEFAULTED
    if (isGuarantor && !isBorrower && loan.status !== 'DEFAULTED') {
        await client.query('ROLLBACK');
        return res.status(403).json({
            success: false,
            message: 'Action Restricted: Guarantors can only initiate repayments if the loan has officially DEFAULTED.'
        });
    }

    const loanBalanceCents = toCents(loan.balance);
    const loanAmountPaidCents = toCents(loan.amount_paid);
    const totalRepayableCents = toCents(loan.total_repayable);

    const newBalanceCents = Math.max(0, loanBalanceCents - repaymentAmountCents);
    const newAmountPaidCents = loanAmountPaidCents + repaymentAmountCents;
    const newAmountPaidDecimal = fromCents(newAmountPaidCents);

    // Find the next upcoming installment(s) to apply this repayment to
    const pendingInstallmentsRes = await client.query(
      `SELECT * FROM loan_schedules 
       WHERE loan_id = $1 AND status = 'PENDING'
       ORDER BY installment_number ASC`,
      [loanId],
    );
    
    let remainingToAllocateCents = repaymentAmountCents;
    for (const installment of pendingInstallmentsRes.rows) {
      const installmentTotalCents = toCents(installment.total_amount);
      if (remainingToAllocateCents >= installmentTotalCents) {
        // Mark this installment as fully paid
        await client.query(
          "UPDATE loan_schedules SET status = 'PAID', paid_at = NOW() WHERE schedule_id = $1",
          [installment.schedule_id]
        );
        remainingToAllocateCents -= installmentTotalCents;
      } else {
        // Partial payment for this installment - for now, we leave as PENDING 
        // but we could implement partial status if needed. 
        // Most Chamas treat an installment as PAID only when fully settled.
        break;
      }
    }

    const nextDueDate = pendingInstallmentsRes.rows.find(i => toCents(i.total_amount) > 0 && remainingToAllocateCents < toCents(i.total_amount))?.due_date || loan.next_payment_at;

    // Update loan
    await client.query(
      `UPDATE loans 
       SET amount_paid = $1::NUMERIC,
           status = CASE WHEN $1::NUMERIC >= total_repayable THEN 'COMPLETED' ELSE status END,
           last_payment_date = NOW(),
           next_payment_at = $2
       WHERE loan_id = $3::INTEGER`,
      [newAmountPaidDecimal, nextDueDate, loanId],
    );

    // Record repayment - explicitly track the payer
    await client.query(
      `INSERT INTO loan_repayments 
       (loan_id, payer_id, amount, payment_method, notes, payment_date)
       VALUES ($1::INTEGER, $2::INTEGER, $3::NUMERIC, $4, $5, NOW())`,
      [loanId, userId, fromCents(repaymentAmountCents), paymentMethod, notes || (isGuarantor && !isBorrower ? 'Repayment by Guarantor' : null)],
    );

    // If the chama uses a revolving fund (ASCA or TABLE_BANKING), return the repayment to the fund
    const chamaTypeResult = await client.query(
      'SELECT chama_type FROM chamas WHERE chama_id = $1',
      [chamaId],
    );
    
    if (chamaTypeResult.rows.length > 0 && ['ASCA', 'TABLE_BANKING'].includes(chamaTypeResult.rows[0].chama_type)) {
      await client.query(
        'UPDATE chamas SET current_fund = current_fund + $1 WHERE chama_id = $2',
        [fromCents(repaymentAmountCents), chamaId],
      );
    }

    await client.query('COMMIT');

    // ISOLATED BACKGROUND TASKS: We use try-catch and don't await if they are not critical for the response
    // to prevent secondary failures from cascading to the user.
    
    // 1. Trust Score Update
    setImmediate(async () => {
        try {
            await TrustScoreService.updateMemberTrustScore(chamaId, loan.borrower_id);
            if (isGuarantor && !isBorrower) {
                await TrustScoreService.updateMemberTrustScore(chamaId, userId); // Boost guarantor score too
            }
        } catch (tsErr) {
            console.error('Non-critical: Failed to update trust score after repayment:', tsErr.message);
        }
    });

    // 2. Audit Event
    setImmediate(async () => {
        try {
            await logAuditEvent({
                eventType: EVENT_TYPES.LOAN_REPAYMENT,
                userId,
                action: isGuarantor && !isBorrower ? 'Guarantor settled loan payment' : 'Made loan repayment',
                entityType: 'loan',
                entityId: loanId,
                metadata: {
                    chamaId,
                    amount,
                    payerType: isBorrower ? 'borrower' : 'guarantor',
                    remainingBalance: fromDecimal(newBalance),
                },
                severity: SEVERITY.MEDIUM,
            });
        } catch (auditErr) {
            console.error('Non-critical: Failed to log audit event after repayment:', auditErr.message);
        }
    });

    // Invalidate stats cache since funds have moved
    clearChamaCache(chamaId);

    res.json({
      success: true,
      message: isGuarantor && !isBorrower ? 'Guarantor repayment recorded' : 'Repayment recorded successfully',
      data: {
        amount,
        remainingBalance: fromDecimal(newBalance),
        isCompleted: newBalance === 0,
        nextDueDate: fromDate(nextDueDate)
      },
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('FATAL: Make repayment error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error processing repayment: ' + error.message,
    });
  } finally {
    if (client) client.release();
  }
};

// @desc    Get user's loan history
// @route   GET /api/loans/my-loans
// @access  Private
const getUserLoans = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { status, page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE l.borrower_id = $1';
    const params = [userId];

    if (status) {
      whereClause += ' AND l.status = $2';
      params.push(status);
    }

    const result = await pool.query(
      `SELECT 
        l.*,
        c.name as chama_name,
        c.type as chama_type
       FROM loans l
       JOIN chamas c ON l.chama_id = c.chama_id
       ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM loans l ${whereClause}`,
      params,
    );

    const loans = result.rows.map(loan => ({
      ...loan,
      loan_amount: fromDecimal(loan.loan_amount),
      total_repayable: fromDecimal(loan.total_repayable),
      amount_paid: fromDecimal(loan.amount_paid),
      balance: fromDecimal(loan.balance),
    }));

    res.json({
      success: true,
      data: {
        loans,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get user loans error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving loan history',
    });
  }
};

// @desc    Get user's incoming guarantee requests and status
// @route   GET /api/loans/my-guarantees
// @access  Private
const getMyGuarantees = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { status, page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;
    const params = [userId];
    let whereClause = 'WHERE lg.guarantor_user_id = $1';

    if (status && status !== 'ALL') {
      whereClause += ' AND lg.status = $2';
      params.push(status);
    }

    const result = await pool.query(
      `SELECT 
        l.loan_id,
        l.loan_amount,
        l.status as loan_status,
        l.purpose,
        l.term_months,
        l.monthly_payment,
        l.created_at,
        lg.guarantee_amount,
        lg.status as guarantee_status,
        u.first_name || ' ' || u.last_name as borrower_name,
        u.user_id as borrower_id,
        c.chama_name,
        c.chama_id
       FROM loan_guarantors lg
       JOIN loans l ON lg.loan_id = l.loan_id
       JOIN users u ON l.borrower_id = u.user_id
       JOIN chamas c ON l.chama_id = c.chama_id
       ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as total 
       FROM loan_guarantors lg 
       JOIN loans l ON lg.loan_id = l.loan_id
       ${whereClause}`,
      params,
    );

    const guarantees = result.rows.map(g => ({
      ...g,
      loan_amount: fromDecimal(g.loan_amount),
      guaranteed_amount: fromDecimal(g.guarantee_amount),
    }));

    res.paginated(
      guarantees,
      parseInt(page),
      parseInt(limit),
      parseInt(countResult.rows[0].total),
      'Guarantees retrieved successfully'
    );
  } catch (error) {
    console.error('Get guarantees error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving guarantees',
    });
  }
};

// @desc    Respond to a guarantee request
// @route   POST /api/loans/:loanId/guarantee/respond
// @access  Private
const respondToGuaranteeRequest = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userId = req.user.user_id;
    const { loanId } = req.params;
    const { decision } = req.body; // ACCEPT or REJECT

    if (!['ACCEPT', 'REJECT'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decision. Must be ACCEPT or REJECT',
      });
    }

    // Verify the request exists and belongs to user
    const checkRes = await client.query(
      `SELECT * FROM loan_guarantors 
       WHERE loan_id = $1 AND guarantor_user_id = $2 AND status = 'PENDING'`,
      [loanId, userId],
    );

    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Guarantee request not found or already processed',
      });
    }

    const status = decision === 'ACCEPT' ? 'APPROVED' : 'REJECTED';

    await client.query(
      `UPDATE loan_guarantors 
       SET status = $1::varchar, 
           approved_at = CASE WHEN $1::varchar = 'APPROVED' THEN NOW() ELSE NULL END
       WHERE loan_id = $2 AND guarantor_user_id = $3`,
      [status, loanId, userId],
    );

    // Notify borrower if rejected
    if (status === 'REJECTED') {
      const borrowerRes = await client.query('SELECT borrower_id, chama_id FROM loans WHERE loan_id = $1', [loanId]);
      if (borrowerRes.rows.length > 0) {
        const { borrower_id } = borrowerRes.rows[0];
        const guarantorRes = await client.query('SELECT first_name, last_name FROM users WHERE user_id = $1', [userId]);
        const gName = guarantorRes.rows[0] ? `${guarantorRes.rows[0].first_name} ${guarantorRes.rows[0].last_name}` : 'A guarantor';
        
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
           VALUES ($1, 'LOAN_GUARANTEE_REJECTED', 'Guarantor Declined', 
                   $2, 'LOAN', $3)`,
          [borrower_id, `${gName} declined your guarantee request for loan #${loanId}. Please select a different guarantor.`, loanId]
        );
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Guarantee request ${status.toLowerCase()}`,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Respond guarantee error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing response',
    });
  } finally {
    client.release();
  }
};

// Standardized Multi-Sig Approval logic moved dynamically into the function body

const approveLoanByOfficial = async (req, res) => {
  const client = await pool.connect();
  try {
    const { loanId } = req.params;
    const userId = req.user.user_id;
    const { action, notes } = req.body || {}; // action: 'APPROVED' | 'REJECTED'

    if (!['APPROVED', 'REJECTED'].includes(action)) {
      return res.status(400).json({ success: false, message: "Action must be APPROVED or REJECTED" });
    }

    // 1. Find the loan and get its chama
    const loanRes = await client.query(
      'SELECT loan_id, chama_id, borrower_id, status FROM loans WHERE loan_id = $1',
      [loanId]
    );
    if (loanRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Loan not found.' });
    }
    const loan = loanRes.rows[0];

    // 2. Block borrower from approving own loan
    if (loan.borrower_id === userId) {
      return res.status(403).json({ success: false, message: 'You cannot approve your own loan.' });
    }

    // 3. Verify that requester is a chama official
    const officialCheck = await client.query(
      "SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true AND role IN ('CHAIRPERSON', 'TREASURER', 'SECRETARY')",
      [loan.chama_id, userId]
    );
    if (officialCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Only Chama officials may approve loans.' });
    }

    // 4. Loan must be in PENDING status
    if (!['PENDING', 'PENDING_APPROVAL'].includes(loan.status)) {
      return res.status(400).json({ success: false, message: `Loan is not awaiting approval. Current status: ${loan.status}` });
    }

    // 4.5 Ensure all guarantors have accepted first
    const pendingGuarantors = await client.query(
      "SELECT COUNT(*) FROM loan_guarantors WHERE loan_id = $1 AND status != 'APPROVED'",
      [loanId]
    );

    if (parseInt(pendingGuarantors.rows[0].count) > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Official approval is blocked until all guarantors have accepted.' 
      });
    }

    await client.query('BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE');

    // === VALIDATE TREASURY LIQUIDITY BEFORE VOTE/APPROVAL ===
    const chamaRes = await client.query('SELECT chama_type FROM chamas WHERE chama_id = $1', [loan.chama_id]);
    const chamaType = chamaRes.rows[0].chama_type;
    const availablePoolCents = toCents(await getAvailableTreasury(client, loan.chama_id, chamaType));
    
    // Add back the current loan amount because it was already deducted by getAvailableTreasury as a pending liability
    const loanAmountCents = toCents(loan.loan_amount || 0);
    const effectivePoolCents = availablePoolCents + loanAmountCents;

    if (loanAmountCents > effectivePoolCents) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Approval Blocked: There are insufficient unallocated funds in the Chama pool to disburse this loan.',
        data: {
          required: fromCents(loanAmountCents),
          available: fromCents(effectivePoolCents)
        }
      });
    }

    // 5. Insert vote (unique constraint prevents double-voting)
    await client.query(
      'INSERT INTO loan_approvals (loan_id, official_user_id, status, notes) VALUES ($1, $2, $3, $4)',
      [loanId, userId, action, notes || null]
    );

    // 6. Count total approvals and get total available admins
    const checkApprovalsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM loan_approvals WHERE loan_id = $1 AND status = 'APPROVED') as approval_count,
        (SELECT COUNT(*) FROM chama_members 
         WHERE chama_id = $2 
         AND role IN ('CHAIRPERSON', 'SECRETARY', 'TREASURER') 
         AND is_active = true) as total_admins
    `;
    const { rows: [approvalStats] } = await client.query(checkApprovalsQuery, [loanId, loan.chama_id]);
    const approvalCount = parseInt(approvalStats.approval_count, 10);
    const totalAdmins = parseInt(approvalStats.total_admins, 10);

    // Standardized Multi-Sig Threshold: at least 2 approvals, or all admins if less than 2
    const threshold = Math.min(2, totalAdmins);

    let newStatus = loan.status;
    let message = `Vote recorded. ${approvalCount}/${threshold} approvals.`;

    if (action === 'REJECTED') {
      // Any official can reject immediately
      newStatus = 'REJECTED';
      message = 'Loan rejected.';
    } else if (approvalCount >= threshold) {
      // Threshold met — approve the loan
      newStatus = 'APPROVED';
      message = `Loan approved. ${approvalCount} officials approved — funds authorized.`;
    }

    if (newStatus !== loan.status) {
      await client.query(
        'UPDATE loans SET status = $1, approved_at = NOW(), approved_by = $2 WHERE loan_id = $3',
        [newStatus, userId, loanId]
      );

      // CRITICAL: If the loan was approved, deduct from chama fund to synchronise assets (Double Recovery Bug Fix)
      if (newStatus === 'APPROVED') {
        const loanAmountRes = await client.query('SELECT loan_amount FROM loans WHERE loan_id = $1', [loanId]);
        const loanAmount = parseFloat(loanAmountRes.rows[0].loan_amount || 0);
        await client.query(
          'UPDATE chamas SET current_fund = current_fund - $1 WHERE chama_id = $2',
          [loanAmount, loan.chama_id]
        );
      }
    }

    await client.query('COMMIT');

    // Invalidate stats cache
    clearChamaCache(loan.chama_id);

    return res.status(200).json({
      success: true,
      message,
      data: { loanId, action, approvalCount, threshold: APPROVAL_THRESHOLD, newStatus }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.logError(error, { context: 'approveLoanByOfficial' });
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'You have already voted on this loan.' });
    }
    return res.status(500).json({ success: false, message: 'Error processing loan approval.' });
  } finally {
    client.release();
  }
};

  /**
   * Get advanced loan analytics for a chama (Officials only)
   */
  const getChamaLoanAnalytics = async (req, res) => {
    const { chamaId } = req.params;

    try {
      // 1. Basic Stats: Total interest, pending, active
      const basicStats = await pool.query(
        `SELECT 
           COALESCE(SUM(total_repayable - loan_amount) FILTER (WHERE status IN ('APPROVED', 'DISBURSED', 'DEFAULTED', 'COMPLETED')), 0) as total_interest_earned,
           COUNT(*) FILTER (WHERE status IN ('APPROVED', 'DISBURSED', 'DEFAULTED')) as active_loans_count,
           COUNT(*) FILTER (WHERE status = 'PENDING') as pending_loans_count,
           COALESCE(SUM(balance) FILTER (WHERE status IN ('APPROVED', 'DISBURSED', 'DEFAULTED')), 0) as total_outstanding_balance,
           COALESCE(SUM(amount_paid) FILTER (WHERE status IN ('APPROVED', 'DISBURSED', 'DEFAULTED', 'COMPLETED')), 0) as total_recovered
         FROM loans 
         WHERE chama_id = $1`,
        [chamaId],
      );

      // 2. Default Rate
      const defaultStats = await pool.query(
        `SELECT 
           COUNT(*) FILTER (WHERE status = 'DEFAULTED') as default_count,
           COUNT(*) as total_count
         FROM loans 
         WHERE chama_id = $1`,
        [chamaId],
      );

      const dStats = defaultStats.rows[0];
      const defaultRate = dStats.total_count > 0 
        ? (parseInt(dStats.default_count) / parseInt(dStats.total_count)) * 100 
        : 0;

      // 3. Upcoming Repayments (Next 30 Days) - Detailed for Dashboard
      const upcomingRepayments = await pool.query(
        `SELECT 
           u.first_name || ' ' || u.last_name as borrower_name,
           ls.total_amount as amount_due,
           ls.due_date as next_repayment_date
         FROM loan_schedules ls
         JOIN loans l ON ls.loan_id = l.loan_id
         JOIN users u ON l.borrower_id = u.user_id
         WHERE l.chama_id = $1 
           AND ls.status = 'PENDING' 
           AND ls.due_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')
         ORDER BY ls.due_date ASC
         LIMIT 5`,
        [chamaId],
      );

      // 4. Monthly Trend (Loans activated last 6 months)
      const monthlyTrends = await pool.query(
        `SELECT 
           TO_CHAR(created_at, 'Mon YYYY') as month,
           SUM(loan_amount) as amount,
           COUNT(*) as count
         FROM loans
         WHERE chama_id = $1 AND status IN ('APPROVED', 'DISBURSED', 'DEFAULTED', 'COMPLETED')
           AND created_at >= (CURRENT_DATE - INTERVAL '6 months')
         GROUP BY TO_CHAR(created_at, 'YYYYMM'), TO_CHAR(created_at, 'Mon YYYY')
         ORDER BY TO_CHAR(created_at, 'YYYYMM') ASC`,
        [chamaId],
      );

      res.status(200).json({
        success: true,
        data: {
          summary: basicStats.rows[0],
          defaultRate: parseFloat(defaultRate.toFixed(2)),
          totalInterestEarned: parseFloat(basicStats.rows[0].total_interest_earned || 0),
          totalOutstanding: parseFloat(basicStats.rows[0].total_outstanding_balance || 0),
          upcomingRepayments: upcomingRepayments.rows,
          disbursementTrends: monthlyTrends.rows
        }
      });

    } catch (error) {
      logger.logError(error, { context: 'getChamaLoanAnalytics', chamaId });
      res.status(500).json({ success: false, message: 'Error fetching loan analytics.' });
    }
  };

// ============================================================================
// LOAN CONFIGURATION (Officials set chama's interest rate & terms)
// ============================================================================

const DEFAULT_LOAN_CONFIG = {
  interest_rate: 10,
  interest_type: 'FLAT',
  loan_multiplier: 3,
  max_repayment_months: 12,
  allowed_categories: ['EMERGENCY', 'SCHOOL_FEES', 'DEVELOPMENT', 'BUSINESS', 'MEDICAL'],
};

/**
 * GET /api/loans/:chamaId/config
 * Returns loan configuration for display in the wizard (public within chama members)
 */
const getLoanConfig = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const result = await pool.query(
      'SELECT constitution_config, chama_type FROM chamas WHERE chama_id = $1 AND is_active = true',
      [chamaId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Chama not found' });
    }

    const loanConfig = {
      ...DEFAULT_LOAN_CONFIG,
      ...(result.rows[0].constitution_config?.loan || {}),
    };

    return res.json({
      success: true,
      data: {
        ...loanConfig,
        chama_type: result.rows[0].chama_type,
      },
    });
  } catch (err) {
    logger.logError(err, { context: 'getLoanConfig' });
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * PUT /api/loans/:chamaId/config
 * Officials-only: update the chama's loan terms
 */
const updateLoanConfig = async (req, res) => {
  const client = await pool.connect();
  try {
    const { chamaId } = req.params;
    const userId = req.user.user_id;
    const {
      interest_rate,
      interest_type,
      loan_multiplier,
      max_repayment_months,
      allowed_categories,
    } = req.body;

    // === Check official role ===
    const officialCheck = await client.query(
      `SELECT role FROM chama_members 
       WHERE chama_id = $1 AND user_id = $2 AND is_active = true
         AND role IN ('CHAIRPERSON', 'TREASURER', 'SECRETARY')`,
      [chamaId, userId],
    );

    if (officialCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Only officials (Chairperson, Treasurer, Secretary) can update loan configuration.',
      });
    }

    // === Validate inputs ===
    const rate = parseFloat(interest_rate);
    const multiplier = parseFloat(loan_multiplier);
    const maxMonths = parseInt(max_repayment_months, 10);

    if (isNaN(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({ success: false, message: 'Interest rate must be 0–100%' });
    }
    if (isNaN(multiplier) || multiplier < 1 || multiplier > 10) {
      return res.status(400).json({ success: false, message: 'Loan multiplier must be 1–10×' });
    }
    if (isNaN(maxMonths) || maxMonths < 1 || maxMonths > 60) {
      return res.status(400).json({ success: false, message: 'Max repayment months must be 1–60' });
    }
    if (!['FLAT', 'REDUCING_BALANCE'].includes(interest_type)) {
      return res.status(400).json({ success: false, message: 'Invalid interest type' });
    }

    await client.query('BEGIN');

    // Get current config
    const current = await client.query(
      'SELECT constitution_config FROM chamas WHERE chama_id = $1 FOR UPDATE',
      [chamaId],
    );
    const existingConfig = current.rows[0]?.constitution_config || {};

    const newLoanConfig = {
      ...DEFAULT_LOAN_CONFIG,
      ...(existingConfig.loan || {}),
      interest_rate: rate,
      interest_type,
      loan_multiplier: multiplier,
      max_repayment_months: maxMonths,
      allowed_categories: Array.isArray(allowed_categories) ? allowed_categories : DEFAULT_LOAN_CONFIG.allowed_categories,
      updated_at: new Date().toISOString(),
    };

    await client.query(
      'UPDATE chamas SET constitution_config = $1 WHERE chama_id = $2',
      [JSON.stringify({ ...existingConfig, loan: newLoanConfig }), chamaId],
    );

    await logAuditEvent(client, {
      chamaId,
      actorId: userId,
      eventType: EVENT_TYPES.SETTINGS_UPDATED,
      severity: SEVERITY.MEDIUM,
      description: `Loan config updated: rate=${rate}%, type=${interest_type}, multiplier=${multiplier}×, maxMonths=${maxMonths}`,
    });

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Loan configuration updated successfully.',
      data: newLoanConfig,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.logError(err, { context: 'updateLoanConfig' });
    return res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

// @desc    Get unified loan summary for dashboard
// @route   GET /api/loans/unified-summary
// @access  Private
const getUnifiedLoanSummary = async (req, res) => {
  try {
    const userId = req.user.user_id;

    // 1. Get loans where user is BORROWER
    const borrowedRes = await pool.query(
      `SELECT 
        l.loan_id,
        l.chama_id,
        l.borrower_id,
        l.loan_amount,
        l.total_repayable,
        l.amount_paid,
        l.balance,
        l.monthly_payment,
        l.status,
        l.created_at,
        c.chama_name,
        c.chama_type,
        (SELECT due_date FROM loan_schedules 
         WHERE loan_id = l.loan_id AND status = 'PENDING' 
         ORDER BY installment_number ASC LIMIT 1) as next_payment_date
       FROM loans l
       JOIN chamas c ON l.chama_id = c.chama_id
       WHERE l.borrower_id = $1 AND l.status IN ('PENDING', 'APPROVED', 'DISBURSED', 'DEFAULTED')
       ORDER BY l.created_at DESC`,
      [userId],
    );

    // 2. Get loans where user is GUARANTOR
    const guaranteedRes = await pool.query(
      `SELECT 
        l.loan_id,
        l.chama_id,
        l.borrower_id,
        l.loan_amount,
        l.total_repayable,
        l.amount_paid,
        l.balance,
        l.status,
        l.created_at,
        c.chama_name,
        c.chama_type,
        u.first_name || ' ' || u.last_name as borrower_name,
        lg.guarantee_amount as my_guarantee_amount,
        lg.status as my_guarantee_status
       FROM loans l
       JOIN chamas c ON l.chama_id = c.chama_id
       JOIN users u ON l.borrower_id = u.user_id
       JOIN loan_guarantors lg ON l.loan_id = lg.loan_id
       WHERE lg.guarantor_user_id = $1 AND l.status IN ('PENDING', 'APPROVED', 'DISBURSED', 'DEFAULTED')
       ORDER BY l.created_at DESC`,
      [userId],
    );

    const borrowed = borrowedRes.rows.map(l => ({
      ...l,
      user_role: 'BORROWER',
      loan_amount: parseFloat(l.loan_amount) || 0,
      total_repayable: parseFloat(l.total_repayable) || 0,
      amount_paid: parseFloat(l.amount_paid) || 0,
      balance: parseFloat(l.balance) || 0,
      monthly_payment: parseFloat(l.monthly_payment) || 0,
    }));

    const guaranteed = guaranteedRes.rows.map(l => ({
      ...l,
      user_role: 'GUARANTOR',
      loan_amount: parseFloat(l.loan_amount) || 0,
      total_repayable: parseFloat(l.total_repayable) || 0,
      amount_paid: parseFloat(l.amount_paid) || 0,
      balance: parseFloat(l.balance) || 0,
      my_guarantee_amount: parseFloat(l.my_guarantee_amount) || 0,
    }));

    res.json({
      success: true,
      data: {
        borrowed,
        guaranteed,
        summary: {
          totalBorrowed: borrowed.reduce((sum, l) => sum + l.balance, 0),
          totalGuaranteed: guaranteed.reduce((sum, l) => sum + l.my_guarantee_amount, 0),
        }
      }
    });
  } catch (error) {
    console.error('Unified summary error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Manually trigger default detection for a chama
// @route   POST /api/loans/:chamaId/settle-defaults
// @access  Private (Official)
const settleChamaDefaults = async (req, res) => {
  try {
    const { chamaId } = req.params;
    
    // Authorization check (simplified, could use middleware)
    const result = await DefaultDetector.detectDefaults();
    
    res.json({
      success: true,
      message: 'Default detection job completed',
      data: result
    });
  } catch (error) {
    console.error('Manual default settlement error:', error);
    res.status(500).json({ success: false, message: 'Server error during default detection' });
  }
};

// @desc    Get loans guaranteed by the current user
// @route   GET /api/loans/my-guaranteed-loans
// @access  Private
const getGuaranteedLoans = async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const result = await pool.query(
      `SELECT 
        l.*,
        u.first_name || ' ' || u.last_name as borrower_name,
        lg.guarantee_amount as my_guarantee_amount,
        lg.status as my_guarantee_status,
        c.chama_name
       FROM loans l
       JOIN loan_guarantors lg ON l.loan_id = lg.loan_id
       JOIN users u ON l.borrower_id = u.user_id
       JOIN chamas c ON l.chama_id = c.chama_id
       WHERE lg.guarantor_user_id = $1 AND lg.status = 'APPROVED'
       ORDER BY l.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        ...row,
        loan_amount: parseFloat(row.loan_amount),
        balance: parseFloat(row.balance),
        amount_paid: parseFloat(row.amount_paid),
        total_repayable: parseFloat(row.total_repayable),
        my_guarantee_amount: parseFloat(row.my_guarantee_amount)
      }))
    });
  } catch (error) {
    console.error('Get guaranteed loans error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  applyForLoan,
  getChamaLoans,
  getLoanById,
  approveLoan,
  rejectLoan,
  makeRepayment,
  getUserLoans,
  getMyGuarantees,
  respondToGuaranteeRequest,
  approveLoanByOfficial,
  getChamaLoanAnalytics,
  getLoanConfig,
  updateLoanConfig,
  getUnifiedLoanSummary,
  settleChamaDefaults,
  getGuaranteedLoans,
  // Export services
  LoanCalculator,
  GuarantorService,
  DefaultDetector,
  LoanConfigService,
};
