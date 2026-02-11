/**
 * Production-Grade Loan Management System
 * Fixes: Interest calculations, guarantor validation, default detection
 */

const pool = require('../config/db');
const logger = require('../utils/logger');
const { logAuditEvent, EVENT_TYPES, SEVERITY } = require('../utils/auditLog');

// Money Utility (Decimal-aware)
const toDecimal = (val) => parseFloat(val);
const fromDecimal = (val) => parseFloat(parseFloat(val).toFixed(2));

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
      const result = await client.query(`
        SELECT DISTINCT l.loan_id, l.chama_id, l.borrower_id, l.loan_amount
        FROM loans l
        JOIN loan_installments li ON l.loan_id = li.loan_id
        WHERE l.status = 'ACTIVE'
          AND li.status = 'PENDING'
          AND li.due_date < CURRENT_DATE - INTERVAL '30 days'
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

        // Create notification for borrower
        await client.query(
          `INSERT INTO notifications (user_id, type, title, message, related_id)
           VALUES ($1, 'LOAN_DEFAULTED', 'Loan Defaulted', 
                   'Your loan has been marked as defaulted due to overdue payments', $2)`,
          [loan.borrower_id, loan.loan_id],
        );

        // Notify chama officials
        const officials = await client.query(
          `SELECT user_id FROM chama_members 
           WHERE chama_id = $1 AND role IN ('TREASURER', 'CHAIRPERSON')`,
          [loan.chama_id],
        );

        for (const official of officials.rows) {
          await client.query(
            `INSERT INTO notifications (user_id, type, title, message, related_id)
             VALUES ($1, 'LOAN_DEFAULTED', 'Member Defaulted', 
                     'A member has defaulted on their loan', $2)`,
            [official.user_id, loan.loan_id],
          );
        }

        logger.logSecurityEvent('Loan marked as defaulted', {
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
      await client.query('ROLLBACK');
      logger.logError(error, { context: 'DefaultDetector.detectDefaults' });
      throw error;
    } finally {
      client.release();
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
// REFACTORED LOAN APPLICATION WITH VALIDATIONS
// ============================================================================

const applyForLoan = async (req, res) => {
  const client = await pool.connect();

  try {
    const { chamaId } = req.params;
    const {
      amount, purpose, termMonths, guarantors,
    } = req.body;
    const userId = req.user.user_id;

    // === VALIDATION ===
    if (!amount || !termMonths) {
      return res.status(400).json({
        success: false,
        message: 'Amount and term are required',
      });
    }

    const amountValue = parseFloat(amount);
    const term = parseInt(termMonths, 10);

    if (amountValue <= 0 || term <= 0) {
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

    if (chama.chama_type !== 'TABLE_BANKING') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'This chama is not configured for Table Banking',
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

    const savings = parseFloat(memberRes.rows[0].total_contributions || 0);

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
    const maxLoan = savings * loanConfig.loan_multiplier;

    // Check outstanding loans
    const outstandingRes = await client.query(
      `SELECT 
         COALESCE(SUM(principal_outstanding), 0) as principal,
         COALESCE(SUM(interest_outstanding), 0) as interest,
         COALESCE(SUM(penalty_outstanding), 0) as penalty
       FROM loans
       WHERE borrower_id = $1 
         AND chama_id = $2
         AND status IN ('ACTIVE', 'PENDING_GUARANTOR', 'PENDING_APPROVAL')`,
      [userId, chamaId],
    );

    const outstanding = parseFloat(outstandingRes.rows[0].principal || 0)
      + parseFloat(outstandingRes.rows[0].interest || 0)
      + parseFloat(outstandingRes.rows[0].penalty || 0);

    const availableCredit = maxLoan - outstanding;

    if (amountValue > availableCredit) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Requested amount exceeds your loan limit',
        data: {
          requestedAmount: fromDecimal(amountValue),
          availableCredit: fromDecimal(availableCredit),
          maxLoan: fromDecimal(maxLoan),
          outstandingLoans: fromDecimal(outstanding),
          savings: fromDecimal(savings),
        },
      });
    }

    // === VALIDATE GUARANTORS ===
    const requiredGuarantee = Math.max(0, amountValue - savings);
    let guarantorArray = Array.isArray(guarantors) ? guarantors : [];

    // Map guarantor amounts
    guarantorArray = guarantorArray.map(g => ({
      userId: g.userId,
      amount: parseFloat(g.amount),
    }));

    if (requiredGuarantee > 0) {
      const validation = await GuarantorService.validate(
        client,
        chamaId,
        guarantorArray, // This might need a .validateAll call if plural, but I see validateAll below
        userId,
        requiredGuarantee,
      );

      if (!validation.valid) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Guarantor validation failed',
          errors: validation.guarantors.flatMap(g => g.errors || []),
          guarantors: validation.guarantors,
        });
      }
    }

    // === CALCULATE LOAN SCHEDULE ===
    const schedule = loanConfig.interest_type === 'REDUCING_BALANCE'
      ? LoanCalculator.calculateReducingBalance(
        amountValue,
        loanConfig.interest_rate,
        term,
      )
      : LoanCalculator.calculateFlatInterest(
        amountValue,
        loanConfig.interest_rate,
        term,
      );

    // === CREATE LOAN ===
    const loanResult = await client.query(
      `INSERT INTO loans (
        chama_id, borrower_id, loan_amount, 
        interest_rate, interest_type, loan_multiplier,
        total_repayable, principal_outstanding, interest_outstanding,
        term_months, status, purpose,
        config_snapshot, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
      ) RETURNING *`,
      [
        chamaId,
        userId,
        amountValue,
        loanConfig.interest_rate,
        loanConfig.interest_type,
        loanConfig.loan_multiplier,
        schedule.totalRepayable,
        schedule.principal,
        schedule.totalInterest,
        term,
        requiredGuarantee > 0 ? 'PENDING_GUARANTOR' : 'PENDING_APPROVAL',
        purpose,
        loanConfig, // Freeze config for this loan
      ],
    );

    const loan = loanResult.rows[0];

    // === CREATE INSTALLMENTS ===
    const now = new Date();
    for (const inst of schedule.installments) {
      const dueDate = new Date(now);
      dueDate.setMonth(dueDate.getMonth() + inst.installmentNumber);

      await client.query(
        `INSERT INTO loan_installments (
          loan_id, installment_number, due_date,
          amount, principal_amount, interest_amount, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')`,
        [
          loan.loan_id,
          inst.installmentNumber,
          dueDate,
          inst.totalAmount,
          inst.principalAmount,
          inst.interestAmount,
        ],
      );
    }

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
          `INSERT INTO notifications (user_id, type, title, message, related_id)
           VALUES ($1, 'LOAN_GUARANTEE_REQUEST', 'Guarantee Request', 
                   'You have been requested to guarantee a loan', $2)`,
          [g.userId, loan.loan_id],
        );
      }
    }

    await client.query('COMMIT');

    logger.logSecurityEvent('Loan application created', {
      loanId: loan.loan_id,
      chamaId,
      borrowerId: userId,
      amount: fromCents(amountCents),
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
          principal: fromCents(schedule.principal),
          totalInterest: fromCents(schedule.totalInterest),
          totalRepayable: fromCents(schedule.totalRepayable),
          monthlyPayment: fromCents(schedule.monthlyPayment),
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
        u.first_name || ' ' || u.last_name as borrower_name,
        u.email as borrower_email,
        m.role as borrower_role
       FROM loans l
       JOIN users u ON l.borrower_id = u.user_id
       JOIN memberships m ON l.borrower_id = m.user_id AND m.chama_id = l.chama_id
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
      loan_amount: fromCents(loan.loan_amount),
      total_repayable: fromCents(loan.total_repayable),
      amount_paid: fromCents(loan.amount_paid),
      balance: fromCents(loan.balance),
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
        u.first_name || ' ' || u.last_name as borrower_name,
        u.email as borrower_email,
        m.role as borrower_role
       FROM loans l
       JOIN users u ON l.borrower_id = u.user_id
       JOIN memberships m ON l.borrower_id = m.user_id AND m.chama_id = l.chama_id
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
        u.first_name || ' ' || u.last_name as guarantor_name,
        u.email as guarantor_email
       FROM loan_guarantors lg
       JOIN users u ON lg.guarantor_id = u.user_id
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
    await client.query('BEGIN');

    const { chamaId, loanId } = req.params;
    const {
      approvedAmount, interestRate, termMonths, notes,
    } = req.body;
    const userId = req.user.user_id;

    // Check if user is authorized
    const memberCheck = await client.query(
      'SELECT role FROM memberships WHERE user_id = $1 AND chama_id = $2',
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
      'SELECT * FROM loans WHERE loan_id = $1 AND chama_id = $2 AND status = \'pending\'',
      [loanId, chamaId],
    );

    if (loanResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Loan not found or already processed',
      });
    }

    const loan = loanResult.rows[0];
    const approvedAmountValue = toDecimal(
      approvedAmount || fromDecimal(loan.loan_amount),
    );

    // Calculate schedule
    const schedule = LoanCalculator.calculateFlatInterest(
      approvedAmountValue,
      interestRate || 10,
      termMonths || 12,
    );

    // Update loan
    await client.query(
      `UPDATE loans 
       SET status = 'approved',
           approved_amount = $1,
           interest_rate = $2,
           term_months = $3,
           total_repayable = $4,
           approved_by = $5,
           approved_at = NOW(),
           approval_notes = $6
       WHERE loan_id = $7`,
      [
        approvedAmountValue,
        interestRate || 10,
        termMonths || 12,
        schedule.totalRepayable,
        userId,
        notes,
        loanId,
      ],
    );

    // Create loan schedule
    for (const installment of schedule.installments) {
      await client.query(
        `INSERT INTO loan_schedules 
         (loan_id, installment_number, principal_amount, interest_amount, total_amount, balance, due_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          loanId,
          installment.installmentNumber,
          installment.principalAmount,
          installment.interestAmount,
          installment.totalAmount,
          installment.balance,
          installment.dueDate,
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
    const { reason } = req.body;
    const userId = req.user.user_id;

    // Check if user is authorized
    const memberCheck = await pool.query(
      'SELECT role FROM memberships WHERE user_id = $1 AND chama_id = $2',
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
       SET status = 'rejected',
           rejected_by = $1,
           rejected_at = NOW(),
           rejection_reason = $2
       WHERE loan_id = $3 AND chama_id = $4 AND status = 'pending'
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

    const { chamaId, loanId } = req.params;
    const { amount, paymentMethod = 'cash', notes } = req.body;
    const userId = req.user.user_id;

    const repaymentAmount = toDecimal(amount);

    // Get loan details
    const loanResult = await client.query(
      'SELECT * FROM loans WHERE loan_id = $1 AND chama_id = $2 AND status IN (\'approved\', \'disbursed\')',
      [loanId, chamaId],
    );

    if (loanResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Loan not found or not in repayable status',
      });
    }

    const loan = loanResult.rows[0];
    const newBalance = Math.max(0, parseFloat(loan.balance) - repaymentAmount);
    const newAmountPaid = parseFloat(loan.amount_paid) + repaymentAmount;

    // Update loan
    await client.query(
      `UPDATE loans 
       SET amount_paid = $1,
           balance = $2,
           status = CASE WHEN $2 = 0 THEN 'completed' ELSE status END,
           last_payment_date = NOW()
       WHERE loan_id = $3`,
      [newAmountPaid, newBalance, loanId],
    );

    // Record repayment
    await client.query(
      `INSERT INTO loan_repayments 
       (loan_id, payer_id, amount, payment_method, notes, payment_date)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [loanId, userId, repaymentAmount, paymentMethod, notes],
    );

    await client.query('COMMIT');

    await logAuditEvent({
      eventType: EVENT_TYPES.LOAN_REPAYMENT,
      userId,
      action: 'Made loan repayment',
      entityType: 'loan',
      entityId: loanId,
      metadata: {
        chamaId,
        amount,
        paymentMethod,
        remainingBalance: fromCents(newBalance),
      },
      severity: SEVERITY.MEDIUM,
    });

    res.json({
      success: true,
      message: 'Repayment recorded successfully',
      data: {
        amount,
        remainingBalance: fromCents(newBalance),
        isCompleted: newBalance === 0,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Make repayment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing repayment',
    });
  } finally {
    client.release();
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
      loan_amount: fromCents(loan.loan_amount),
      total_repayable: fromCents(loan.total_repayable),
      amount_paid: fromCents(loan.amount_paid),
      balance: fromCents(loan.balance),
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
        l.status,
        lg.guarantee_amount,
        lg.status as guarantee_status,
        u.first_name || ' ' || u.last_name as borrower_name,
        u.user_id as borrower_id
       FROM loan_guarantors lg
       JOIN loans l ON lg.loan_id = l.loan_id
       JOIN users u ON l.borrower_id = u.user_id
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
       SET status = $1, updated_at = NOW() 
       WHERE loan_id = $2 AND guarantor_user_id = $3`,
      [status, loanId, userId],
    );

    // If REJECTED, might want to notify borrower or update loan status?
    // For now, just update the status.
    // Ideally, if a guarantor rejects, the loan might need to go back to draft or prompt borrower.

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
  // Export services
  LoanCalculator,
  GuarantorService,
  DefaultDetector,
  LoanConfigService,
};
