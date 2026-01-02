const pool = require("../config/db");
const { isValidAmount } = require("../utils/validators");
const logger = require("../utils/logger");
const { createNotification } = require("../utils/notificationService");
const NodeCache = require("node-cache");

// Cache for chama loans (short TTL to reduce DB load while keeping data fresh)
const loanCache = new NodeCache({ stdTTL: 60, checkperiod: 30 });
const getLoansCacheKey = (chamaId) => `loans_chama_${chamaId}`;
const clearLoansCache = (chamaId) => {
    if (!chamaId) return;
    loanCache.del(getLoansCacheKey(chamaId));
};

// ---- Helpers: loan constitution & config ----

const DEFAULT_LOAN_CONFIG = {
    interest_rate: 10,
    interest_type: "FLAT",
    loan_multiplier: 3,
    max_repayment_months: 6,
    max_concurrent_loans: 1,
    max_applications_per_day: 3,
};

const getEffectiveLoanConfig = (constitutionConfig) => {
    const base = (constitutionConfig && constitutionConfig.loan) || {};
    return {
        interest_rate: base.interest_rate ?? DEFAULT_LOAN_CONFIG.interest_rate,
        interest_type: base.interest_type ?? DEFAULT_LOAN_CONFIG.interest_type,
        loan_multiplier: base.loan_multiplier ?? DEFAULT_LOAN_CONFIG.loan_multiplier,
        max_repayment_months:
            base.max_repayment_months ?? DEFAULT_LOAN_CONFIG.max_repayment_months,
        max_concurrent_loans:
            base.max_concurrent_loans ?? DEFAULT_LOAN_CONFIG.max_concurrent_loans,
        max_applications_per_day:
            base.max_applications_per_day ?? DEFAULT_LOAN_CONFIG.max_applications_per_day,
    };
};

// @desc    Get loan configuration (constitution) for a chama
// @route   GET /api/loans/:chamaId/config
// @access  Private (member or official)
const getLoanConfig = async (req, res) => {
    try {
        const { chamaId } = req.params;

        const chamaRes = await pool.query(
            "SELECT chama_type, constitution_config FROM chamas WHERE chama_id = $1 AND is_active = true",
            [chamaId]
        );

        if (chamaRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Chama not found" });
        }

        const chama = chamaRes.rows[0];
        if (chama.chama_type !== "TABLE_BANKING") {
            return res.status(400).json({
                success: false,
                message: "This chama is not configured for Table Banking",
            });
        }

        const config = getEffectiveLoanConfig(chama.constitution_config);

        return res.json({ success: true, data: config });
    } catch (error) {
        logger.logError(error, { context: "getLoanConfig" });
        return res.status(500).json({
            success: false,
            message: "Error fetching loan configuration",
        });
    }
};

// @desc    Update loan configuration (constitution) for a chama
// @route   PUT /api/loans/:chamaId/config
// @access  Private (Treasurer via middleware)
const updateLoanConfig = async (req, res) => {
    const client = await pool.connect();
    try {
        const { chamaId } = req.params;
        const {
            interest_rate,
            interest_type,
            loan_multiplier,
            max_repayment_months,
            max_concurrent_loans,
            max_applications_per_day,
        } = req.body;

        await client.query("BEGIN");

        const chamaRes = await client.query(
            "SELECT constitution_config, chama_type FROM chamas WHERE chama_id = $1 FOR UPDATE",
            [chamaId]
        );

        if (chamaRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Chama not found" });
        }

        const chama = chamaRes.rows[0];
        if (chama.chama_type !== "TABLE_BANKING") {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Only TABLE_BANKING chamas can have loan configuration",
            });
        }

        const currentConfig = chama.constitution_config || {};
        const loanConfig = currentConfig.loan || {};

        const updatedLoanConfig = {
            ...loanConfig,
        };

        if (interest_rate !== undefined) {
            const r = Number(interest_rate);
            if (isNaN(r) || r <= 0 || r > 100) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: "interest_rate must be between 0 and 100",
                });
            }
            updatedLoanConfig.interest_rate = r;
        }

        if (interest_type !== undefined) {
            const allowed = ["FLAT", "REDUCING"];
            if (!allowed.includes(interest_type)) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: "interest_type must be FLAT or REDUCING",
                });
            }
            updatedLoanConfig.interest_type = interest_type;
        }

        if (loan_multiplier !== undefined) {
            const m = Number(loan_multiplier);
            if (isNaN(m) || m <= 0 || m > 10) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: "loan_multiplier must be between 0 and 10",
                });
            }
            updatedLoanConfig.loan_multiplier = m;
        }

        if (max_repayment_months !== undefined) {
            const mm = parseInt(max_repayment_months, 10);
            if (isNaN(mm) || mm <= 0 || mm > 60) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: "max_repayment_months must be between 1 and 60",
                });
            }
            updatedLoanConfig.max_repayment_months = mm;
        }

        if (max_concurrent_loans !== undefined) {
            const mc = parseInt(max_concurrent_loans, 10);
            if (isNaN(mc) || mc <= 0 || mc > 5) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: "max_concurrent_loans must be between 1 and 5",
                });
            }
            updatedLoanConfig.max_concurrent_loans = mc;
        }

        if (max_applications_per_day !== undefined) {
            const ma = parseInt(max_applications_per_day, 10);
            if (isNaN(ma) || ma <= 0 || ma > 10) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: "max_applications_per_day must be between 1 and 10",
                });
            }
            updatedLoanConfig.max_applications_per_day = ma;
        }

        const updatedConstitution = {
            ...currentConfig,
            loan: updatedLoanConfig,
        };

        await client.query(
            "UPDATE chamas SET constitution_config = $1 WHERE chama_id = $2",
            [updatedConstitution, chamaId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: "Loan configuration updated successfully",
            data: getEffectiveLoanConfig(updatedConstitution),
        });
    } catch (error) {
        await client.query("ROLLBACK");
        logger.logError(error, { context: "updateLoanConfig" });
        return res.status(500).json({
            success: false,
            message: "Error updating loan configuration",
        });
    } finally {
        client.release();
    }
};

// ---- Core Table Banking loan flow ----

// @desc    Apply for a loan
// @route   POST /api/loans/:chamaId/apply
// @access  Private
const applyForLoan = async (req, res) => {
    const client = await pool.connect();
    try {
        const { chamaId } = req.params;
        const { amount, purpose, termMonths, guarantors } = req.body;
        const userId = req.user.user_id;

        if (!amount || !termMonths) {
            return res.status(400).json({
                success: false,
                message: "Amount and termMonths are required",
            });
        }

        if (!isValidAmount(amount)) {
            return res.status(400).json({
                success: false,
                message: "Invalid loan amount",
            });
        }

        const term = parseInt(termMonths, 10);
        if (isNaN(term) || term <= 0) {
            return res.status(400).json({
                success: false,
                message: "termMonths must be a positive integer",
            });
        }

        await client.query("BEGIN");

        // Check chama and config
        const chamaRes = await client.query(
            "SELECT chama_type, constitution_config FROM chamas WHERE chama_id = $1 AND is_active = true",
            [chamaId]
        );

        if (chamaRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Chama not found" });
        }

        const chama = chamaRes.rows[0];
        if (chama.chama_type !== "TABLE_BANKING") {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "This chama is not configured for Table Banking",
            });
        }

        const loanConfig = getEffectiveLoanConfig(chama.constitution_config);
        if (term > loanConfig.max_repayment_months) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: `Maximum allowed term is ${loanConfig.max_repayment_months} months`,
            });
        }

        // Check if user is a member and active
        const memberRes = await client.query(
            "SELECT total_contributions, is_active FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true",
            [chamaId, userId]
        );

        if (memberRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(403).json({
                success: false,
                message: "You are not an active member of this chama",
            });
        }

        const member = memberRes.rows[0];
        const totalSavings = Number(member.total_contributions) || 0;

        // Check for defaulted and concurrent loans
        const existingLoansRes = await client.query(
            "SELECT status, total_repayable, amount_paid, principal_outstanding, interest_outstanding, penalty_outstanding FROM loans WHERE chama_id = $1 AND borrower_id = $2 AND status IN ('PENDING','PENDING_GUARANTOR','PENDING_APPROVAL','ACTIVE','DEFAULTED')",
            [chamaId, userId]
        );

        const hasDefaulted = existingLoansRes.rows.some((l) => l.status === "DEFAULTED");
        if (hasDefaulted) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "You have a defaulted loan and are not eligible for a new one",
            });
        }

        const activeCount = existingLoansRes.rows.length;
        if (activeCount >= loanConfig.max_concurrent_loans) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "You have reached the maximum number of concurrent loans",
            });
        }

        // Per-user daily application limit
        const dailyCountRes = await client.query(
            `SELECT COUNT(*) AS count
             FROM loans
             WHERE chama_id = $1 AND borrower_id = $2
               AND created_at::date = CURRENT_DATE`,
            [chamaId, userId]
        );
        const dailyCount = parseInt(dailyCountRes.rows[0].count, 10) || 0;
        if (dailyCount >= loanConfig.max_applications_per_day) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: `You have reached the maximum of ${loanConfig.max_applications_per_day} loan applications for today`,
            });
        }

        // Compute outstanding loans (fallback to total_repayable - amount_paid for legacy loans)
        let outstandingLoans = 0;
        for (const l of existingLoansRes.rows) {
            const principal = l.principal_outstanding;
            const interest = l.interest_outstanding;
            const penalty = l.penalty_outstanding;
            if (principal != null || interest != null || penalty != null) {
                outstandingLoans +=
                    (Number(principal) || 0) +
                    (Number(interest) || 0) +
                    (Number(penalty) || 0);
            } else {
                // Legacy loan fallback
                outstandingLoans +=
                    (Number(l.total_repayable) || 0) - (Number(l.amount_paid) || 0);
            }
        }

        const numericAmount = Number(amount);
        const maxLoan = totalSavings * loanConfig.loan_multiplier - outstandingLoans;
        if (maxLoan <= 0 || numericAmount > maxLoan) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Requested amount exceeds your loan limit",
                maxLoan: Math.max(0, maxLoan),
            });
        }

        // Guarantor requirement
        let guarantorArray = Array.isArray(guarantors) ? guarantors : [];
        const requiredGuarantee = Math.max(0, numericAmount - totalSavings);

        if (requiredGuarantee > 0) {
            if (!guarantorArray.length) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: "Guarantors are required for this loan amount",
                });
            }

            // Validate guarantors are active members and not the borrower
            const guarantorIds = guarantorArray.map((g) => Number(g.userId)).filter(Boolean);
            if (guarantorIds.includes(userId)) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: "You cannot guarantee your own loan",
                });
            }

            const guaRes = await client.query(
                "SELECT user_id FROM chama_members WHERE chama_id = $1 AND user_id = ANY($2::int[]) AND is_active = true",
                [chamaId, guarantorIds]
            );

            const validIds = new Set(guaRes.rows.map((r) => r.user_id));
            guarantorArray = guarantorArray.filter((g) => validIds.has(Number(g.userId)));

            if (!guarantorArray.length) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: "No valid guarantors provided",
                });
            }

            const totalGuaranteed = guarantorArray.reduce(
                (sum, g) => sum + (Number(g.amount) || 0),
                0
            );

            if (totalGuaranteed < requiredGuarantee) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: "Guarantor coverage is less than required",
                    requiredGuarantee,
                    totalGuaranteed,
                });
            }
        }

        // Compute interest and schedule (simple flat implementation for now)
        const rate = loanConfig.interest_rate / 100;
        const totalInterest = numericAmount * rate;
        const totalRepayable = numericAmount + totalInterest;
        const principalPerMonth = numericAmount / term;
        const interestPerMonth = totalInterest / term;

        const now = new Date();
        const installments = [];
        for (let i = 1; i <= term; i++) {
            const due = new Date(now);
            due.setMonth(due.getMonth() + i);
            const principalAmt = Number(principalPerMonth.toFixed(2));
            const interestAmt = Number(interestPerMonth.toFixed(2));
            installments.push({
                due_date: due,
                amount: principalAmt + interestAmt,
                principal_amount: principalAmt,
                interest_amount: interestAmt,
            });
        }

        const finalDueDate = installments[installments.length - 1].due_date;
        const initialStatus = requiredGuarantee > 0 ? "PENDING_GUARANTOR" : "PENDING_APPROVAL";

        const metadata = {
            required_guarantee: requiredGuarantee,
            created_at: now.toISOString(),
            config_snapshot: loanConfig,
        };

        const loanInsertRes = await client.query(
            `INSERT INTO loans (
                chama_id,
                borrower_id,
                loan_amount,
                interest_rate,
                interest_type,
                loan_multiplier,
                total_repayable,
                amount_paid,
                principal_outstanding,
                interest_outstanding,
                penalty_outstanding,
                guarantor_coverage,
                loan_date,
                due_date,
                term_months,
                status,
                purpose,
                metadata
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,0,$8,$9,0,0,$10,$11,$12,$13,$14,$15
            ) RETURNING *`,
            [
                chamaId,
                userId,
                numericAmount,
                loanConfig.interest_rate,
                loanConfig.interest_type,
                loanConfig.loan_multiplier,
                totalRepayable,
                numericAmount,
                totalInterest,
                now,
                finalDueDate,
                term,
                initialStatus,
                purpose,
                metadata,
            ]
        );

        const loan = loanInsertRes.rows[0];

        // Clear chama loans cache since data has changed
        clearLoansCache(chamaId);

        // Insert installments
        for (const inst of installments) {
            await client.query(
                `INSERT INTO loan_installments (loan_id, due_date, amount, principal_amount, interest_amount)
                 VALUES ($1,$2,$3,$4,$5)`,
                [
                    loan.loan_id,
                    inst.due_date,
                    inst.amount,
                    inst.principal_amount,
                    inst.interest_amount,
                ]
            );
        }

        // Insert guarantors if any
        if (requiredGuarantee > 0 && guarantorArray.length) {
            for (const g of guarantorArray) {
                await client.query(
                    `INSERT INTO loan_guarantors (loan_id, guarantor_id, guaranteed_amount)
                     VALUES ($1,$2,$3)
                     ON CONFLICT (loan_id, guarantor_id) DO UPDATE SET guaranteed_amount = EXCLUDED.guaranteed_amount`,
                    [loan.loan_id, g.userId, Number(g.amount) || 0]
                );

                // Notify guarantor about request
                await createNotification(client, {
                    userId: g.userId,
                    type: "LOAN_GUARANTEE_REQUEST",
                    title: "Loan guarantee request",
                    message: `A member has requested you to guarantee a loan of KES ${numericAmount.toFixed(2)}.`,
                    relatedId: loan.loan_id,
                });
            }
        }

        // Notify borrower about application receipt
        await createNotification(client, {
            userId,
            type: "LOAN_APPLICATION_CREATED",
            title: "Loan application received",
            message: `Your loan application of KES ${numericAmount.toFixed(2)} has been submitted.`,
            relatedId: loan.loan_id,
        });

        await client.query("COMMIT");

        logger.logRequest(req, "Loan application created", {
            loanId: loan.loan_id,
            chamaId,
            borrowerId: userId,
        });

        return res.status(201).json({
            success: true,
            message: "Loan application submitted successfully",
            data: {
                loan,
                config: loanConfig,
                totalSavings,
                outstandingLoans,
                maxLoan,
            },
        });
    } catch (error) {
        await client.query("ROLLBACK");
        logger.logError(error, { context: "applyForLoan" });
        return res.status(500).json({
            success: false,
            message: "Error applying for loan",
        });
    } finally {
        client.release();
    }
};

// @desc    Get all loans for a chama
// @route   GET /api/loans/:chamaId
// @access  Private (members only)
const getChamaLoans = async (req, res) => {
    try {
        const { chamaId } = req.params;
        const userId = req.user.user_id;

        // Ensure caller is an active member of this chama
        const membershipRes = await pool.query(
            `SELECT 1 FROM chama_members
             WHERE chama_id = $1 AND user_id = $2 AND is_active = true`,
            [chamaId, userId]
        );

        if (membershipRes.rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this chama",
            });
        }

        const cacheKey = getLoansCacheKey(chamaId);
        const cached = loanCache.get(cacheKey);
        if (cached) {
            return res.json({
                success: true,
                count: cached.length,
                data: cached,
                cached: true,
            });
        }

        const result = await pool.query(
            `SELECT l.*, u.first_name || ' ' || u.last_name as borrower_name
       FROM loans l
       JOIN users u ON l.borrower_id = u.user_id
       WHERE l.chama_id = $1
       ORDER BY l.created_at DESC`,
            [chamaId]
        );

        loanCache.set(cacheKey, result.rows);

        res.json({
            success: true,
            count: result.rows.length,
            data: result.rows,
        });
    } catch (error) {
        logger.logError(error, { context: "getChamaLoans" });
        res.status(500).json({
            success: false,
            message: "Error fetching loans",
        });
    }
};

// @desc    Get guarantors and installments for a loan
// @route   GET /api/loans/:loanId/guarantors
// @access  Private (members of the chama only)
const getLoanGuarantors = async (req, res) => {
    try {
        const { loanId } = req.params;
        const userId = req.user.user_id;

        const loanRes = await pool.query(
            `SELECT l.*, u.first_name || ' ' || u.last_name as borrower_name
             FROM loans l
             JOIN users u ON l.borrower_id = u.user_id
             WHERE l.loan_id = $1`,
            [loanId]
        );

        if (loanRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Loan not found" });
        }

        const loan = loanRes.rows[0];

        // Ensure caller is a member of the chama that owns this loan
        const membershipRes = await pool.query(
            `SELECT 1 FROM chama_members
             WHERE chama_id = $1 AND user_id = $2 AND is_active = true`,
            [loan.chama_id, userId]
        );

        if (membershipRes.rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this chama",
            });
        }

        const guarantorsRes = await pool.query(
            `SELECT lg.id,
                    lg.loan_id,
                    lg.guarantor_id,
                    lg.guaranteed_amount,
                    lg.status,
                    lg.created_at,
                    lg.responded_at,
                    u.first_name,
                    u.last_name
             FROM loan_guarantors lg
             JOIN users u ON lg.guarantor_id = u.user_id
             WHERE lg.loan_id = $1`,
            [loanId]
        );

        const installmentsRes = await pool.query(
            `SELECT id, loan_id, due_date, amount, principal_amount, interest_amount, penalty_amount, status, paid_at
             FROM loan_installments
             WHERE loan_id = $1
             ORDER BY due_date ASC`,
            [loanId]
        );

        return res.json({
            success: true,
            data: {
                loan,
                guarantors: guarantorsRes.rows,
                installments: installmentsRes.rows,
            },
        });
    } catch (error) {
        logger.logError(error, { context: "getLoanGuarantors" });
        return res.status(500).json({
            success: false,
            message: "Error fetching guarantors",
        });
    }
};

// @desc    Get loans where current user is a guarantor
// @route   GET /api/loans/my/guarantees
// @access  Private
const getMyGuarantees = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const result = await pool.query(
            `SELECT 
                l.loan_id,
                l.chama_id,
                l.borrower_id,
                l.loan_amount,
                l.interest_rate,
                l.interest_type,
                l.total_repayable,
                l.amount_paid,
                l.status,
                lg.guaranteed_amount,
                lg.status as guarantee_status,
                u.first_name || ' ' || u.last_name as borrower_name
             FROM loan_guarantors lg
             JOIN loans l ON lg.loan_id = l.loan_id
             JOIN users u ON l.borrower_id = u.user_id
             WHERE lg.guarantor_id = $1
             ORDER BY l.created_at DESC`,
            [userId]
        );

        return res.json({
            success: true,
            count: result.rows.length,
            data: result.rows,
        });
    } catch (error) {
        logger.logError(error, { context: "getMyGuarantees" });
        return res.status(500).json({
            success: false,
            message: "Error fetching guarantees",
        });
    }
};

// @desc    Guarantor accept/decline a loan guarantee
// @route   POST /api/loans/:loanId/guarantors/respond
// @access  Private
const respondToGuarantor = async (req, res) => {
    const client = await pool.connect();
    try {
        const { loanId } = req.params;
        const { decision } = req.body; // 'ACCEPT' or 'REJECT'
        const userId = req.user.user_id;

        if (!["ACCEPT", "REJECT"].includes(decision)) {
            return res.status(400).json({ success: false, message: "Invalid decision" });
        }

        await client.query("BEGIN");

        const loanRes = await client.query(
            "SELECT * FROM loans WHERE loan_id = $1 FOR UPDATE",
            [loanId]
        );
        if (loanRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Loan not found" });
        }
        const loan = loanRes.rows[0];

        if (loan.status !== "PENDING_GUARANTOR" && loan.status !== "PENDING_APPROVAL") {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Loan is not in a guarantor-pending state",
            });
        }

        const guarRes = await client.query(
            "SELECT * FROM loan_guarantors WHERE loan_id = $1 AND guarantor_id = $2 FOR UPDATE",
            [loanId, userId]
        );
        if (guarRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(403).json({
                success: false,
                message: "You are not a guarantor for this loan",
            });
        }

        const newStatus = decision === "ACCEPT" ? "ACCEPTED" : "REJECTED";
        await client.query(
            "UPDATE loan_guarantors SET status = $1, responded_at = NOW() WHERE loan_id = $2 AND guarantor_id = $3",
            [newStatus, loanId, userId]
        );

        // Recompute coverage
        const covRes = await client.query(
            "SELECT COALESCE(SUM(guaranteed_amount),0) AS coverage FROM loan_guarantors WHERE loan_id = $1 AND status = 'ACCEPTED'",
            [loanId]
        );
        const coverage = Number(covRes.rows[0].coverage) || 0;

        let nextStatus = loan.status;
        const required = loan.metadata?.required_guarantee || 0;
        if (coverage >= required && loan.status === "PENDING_GUARANTOR") {
            nextStatus = "PENDING_APPROVAL";
        }

        await client.query(
            "UPDATE loans SET guarantor_coverage = $1, status = $2 WHERE loan_id = $3",
            [coverage, nextStatus, loanId]
        );

        await createNotification(client, {
            userId: loan.borrower_id,
            type: "LOAN_GUARANTOR_DECISION",
            title: "Guarantor decision",
            message: `A guarantor has ${decision.toLowerCase()}ed your loan guarantee request.`,
            relatedId: loan.loan_id,
        });

        await client.query("COMMIT");

        logger.logSecurityEvent("Guarantor decision", {
            loanId,
            guarantorId: userId,
            decision,
            coverage,
            required,
        });

        return res.json({
            success: true,
            message: `Guarantor decision recorded: ${decision}`,
            guarantorCoverage: coverage,
            status: nextStatus,
        });
    } catch (error) {
        await client.query("ROLLBACK");
        logger.logError(error, { context: "respondToGuarantor" });
        return res.status(500).json({
            success: false,
            message: "Error processing guarantor response",
        });
    } finally {
        client.release();
    }
};

// @desc    Approve/Reject loan (Treasurer/Admin)
// @route   PUT /api/loans/:loanId/approve
// @access  Private (Officials via middleware)
const respondToLoan = async (req, res) => {
    const client = await pool.connect();
    try {
        const { loanId } = req.params;
        const { status } = req.body; // 'ACTIVE' (approve) or 'CANCELLED' (reject)

        if (!["ACTIVE", "CANCELLED"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        await client.query("BEGIN");

        const loanResult = await client.query(
            "SELECT * FROM loans WHERE loan_id = $1 FOR UPDATE",
            [loanId]
        );
        if (loanResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Loan not found" });
        }
        const loan = loanResult.rows[0];

        // RBAC: only the treasurer of this chama can approve/cancel loans
        const roleRes = await client.query(
            "SELECT role FROM chama_members WHERE chama_id = $1 AND user_id = $2 AND is_active = true",
            [loan.chama_id, req.user.user_id]
        );

        if (roleRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(403).json({
                success: false,
                message: "You are not a member of this chama",
            });
        }

        const approverRole = roleRes.rows[0].role;
        if (approverRole !== "TREASURER") {
            await client.query("ROLLBACK");
            return res.status(403).json({
                success: false,
                message: "Only the treasurer can approve or cancel loans",
            });
        }

        if (loan.status !== "PENDING_APPROVAL") {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Loan is not ready for approval",
            });
        }

        if (status === "CANCELLED") {
            await client.query(
                "UPDATE loans SET status = 'CANCELLED' WHERE loan_id = $1",
                [loanId]
            );

            await createNotification(client, {
                userId: loan.borrower_id,
                type: "LOAN_CANCELLED",
                title: "Loan cancelled",
                message: "Your loan application has been cancelled by an official.",
                relatedId: loan.loan_id,
            });

            await client.query("COMMIT");

            logger.logSecurityEvent("Loan cancelled", {
                loanId,
                actorId: req.user.user_id,
            });

            return res.json({ success: true, message: "Loan cancelled" });
        }

        // Approve (ACTIVE)
        const chamaRes = await client.query(
            "SELECT current_fund FROM chamas WHERE chama_id = $1 FOR UPDATE",
            [loan.chama_id]
        );

        if (!chamaRes.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Chama not found" });
        }

        const currentFund = Number(chamaRes.rows[0].current_fund) || 0;
        if (currentFund < Number(loan.loan_amount)) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Insufficient chama funds",
            });
        }

        await client.query(
            "UPDATE chamas SET current_fund = current_fund - $1 WHERE chama_id = $2",
            [loan.loan_amount, loan.chama_id]
        );

        const updatedLoan = await client.query(
            "UPDATE loans SET status = 'ACTIVE', approved_by = $1, loan_date = CURRENT_DATE WHERE loan_id = $2 RETURNING *",
            [req.user.user_id, loanId]
        );

        // Clear loans cache for this chama
        clearLoansCache(loan.chama_id);

        await client.query("COMMIT");
            userId: loan.borrower_id,
            type: "LOAN_APPROVED",
            title: "Loan approved",
            message: `Your loan of KES ${loan.loan_amount} has been approved.",
            relatedId: loan.loan_id,
        });

        await client.query("COMMIT");

        logger.logSecurityEvent("Loan approved", {
            loanId,
            chamaId: loan.chama_id,
            actorId: req.user.user_id,
        });

        res.json({
            success: true,
            message: "Loan approved successfully",
            data: updatedLoan.rows[0],
        });
    } catch (error) {
        await client.query("ROLLBACK");
        logger.logError(error, { context: "respondToLoan" });
        res.status(500).json({ success: false, message: "Error processing loan" });
    } finally {
        client.release();
    }
};

// @desc    Repay loan with waterfall allocation
// @route   POST /api/loans/:loanId/repay
// @access  Private
const repayLoan = async (req, res) => {
    const client = await pool.connect();
    try {
        const { loanId } = req.params;
        const { amount, source = "CASH" } = req.body;

        if (!isValidAmount(amount)) {
            return res.status(400).json({ success: false, message: "Invalid amount" });
        }

        await client.query("BEGIN");

        const loanRes = await client.query(
            "SELECT * FROM loans WHERE loan_id = $1 FOR UPDATE",
            [loanId]
        );
        if (loanRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Loan not found" });
        }
        const loan = loanRes.rows[0];

        const numericAmount = Number(amount);
        let remaining = numericAmount;

        let penaltyComponent = 0;
        let interestComponent = 0;
        let principalComponent = 0;

        // Waterfall: penalties -> interest -> principal
        if (loan.penalty_outstanding != null && loan.penalty_outstanding > 0 && remaining > 0) {
            const payPenalty = Math.min(remaining, Number(loan.penalty_outstanding));
            penaltyComponent = payPenalty;
            remaining -= payPenalty;
        }

        if (loan.interest_outstanding != null && loan.interest_outstanding > 0 && remaining > 0) {
            const payInterest = Math.min(remaining, Number(loan.interest_outstanding));
            interestComponent = payInterest;
            remaining -= payInterest;
        }

        if (loan.principal_outstanding != null && loan.principal_outstanding > 0 && remaining > 0) {
            const payPrincipal = Math.min(remaining, Number(loan.principal_outstanding));
            principalComponent = payPrincipal;
            remaining -= payPrincipal;
        }

        // Fallback for legacy loans: if no breakout fields, treat all as principal
        if (
            loan.principal_outstanding == null &&
            loan.interest_outstanding == null &&
            loan.penalty_outstanding == null
        ) {
            principalComponent = numericAmount;
        }

        const newPenaltyOutstanding =
            (Number(loan.penalty_outstanding) || 0) - penaltyComponent;
        const newInterestOutstanding =
            (Number(loan.interest_outstanding) || 0) - interestComponent;
        const newPrincipalOutstanding =
            (Number(loan.principal_outstanding) || 0) - principalComponent;

        const newAmountPaid = (Number(loan.amount_paid) || 0) + numericAmount;
        let newStatus = loan.status;

        if (
            newPrincipalOutstanding <= 0.0001 &&
            newInterestOutstanding <= 0.0001 &&
            newPenaltyOutstanding <= 0.0001
        ) {
            newStatus = "COMPLETED";
        }

        // Record repayment with breakdown
        await client.query(
            `INSERT INTO loan_repayments (
                loan_id,
                amount,
                repayment_date,
                recorded_by,
                principal_component,
                interest_component,
                penalty_component,
                source
            ) VALUES ($1,$2,CURRENT_DATE,$3,$4,$5,$6,$7)`,
            [
                loanId,
                numericAmount,
                req.user.user_id,
                principalComponent,
                interestComponent,
                penaltyComponent,
                source,
            ]
        );

        await client.query(
            `UPDATE loans
             SET amount_paid = $1,
                 principal_outstanding = NULLIF($2,0),
                 interest_outstanding = NULLIF($3,0),
                 penalty_outstanding = NULLIF($4,0),
                 status = $5
             WHERE loan_id = $6`,
            [
                newAmountPaid,
                Math.max(0, newPrincipalOutstanding),
                Math.max(0, newInterestOutstanding),
                Math.max(0, newPenaltyOutstanding),
                newStatus,
                loanId,
            ]
        );

        // Add back to Chama funds
        await client.query(
            "UPDATE chamas SET current_fund = current_fund + $1 WHERE chama_id = $2",
            [numericAmount, loan.chama_id]
        );

        // Clear chama loans cache since balances changed
        clearLoansCache(loan.chama_id);

        await client.query("COMMIT");
            userId: loan.borrower_id,
            type: "LOAN_REPAYMENT_RECEIVED",
            title: "Loan repayment received",
            message: `We have received your repayment of KES ${numericAmount.toFixed(2)}.",
            relatedId: loan.loan_id,
        });

        await client.query("COMMIT");

        logger.logRequest(req, "Loan repayment recorded", {
            loanId,
            chamaId: loan.chama_id,
            amount: numericAmount,
            principalComponent,
            interestComponent,
            penaltyComponent,
        });

        res.json({
            success: true,
            message: "Repayment recorded successfully",
            status: newStatus,
            components: {
                principal: principalComponent,
                interest: interestComponent,
                penalty: penaltyComponent,
            },
        });
    } catch (error) {
        await client.query("ROLLBACK");
        logger.logError(error, { context: "repayLoan" });
        res.status(500).json({ success: false, message: "Error recording repayment" });
    } finally {
        client.release();
    }
};

// @desc    Export loans + guarantors report as CSV for a chama
// @route   GET /api/loans/:chamaId/report
// @access  Private (Treasurer)
const exportLoansReport = async (req, res) => {
    try {
        const { chamaId } = req.params;

        const result = await pool.query(
            `SELECT 
                l.loan_id,
                l.chama_id,
                l.loan_amount,
                l.interest_rate,
                l.interest_type,
                l.total_repayable,
                l.amount_paid,
                l.status,
                l.principal_outstanding,
                l.interest_outstanding,
                l.penalty_outstanding,
                l.created_at as loan_created_at,
                l.due_date,
                ub.first_name || ' ' || ub.last_name as borrower_name,
                lg.guarantor_id,
                ug.first_name || ' ' || ug.last_name as guarantor_name,
                lg.guaranteed_amount,
                lg.status as guarantee_status,
                lg.created_at as guarantee_created_at,
                lg.responded_at as guarantee_responded_at
             FROM loans l
             JOIN users ub ON l.borrower_id = ub.user_id
             LEFT JOIN loan_guarantors lg ON lg.loan_id = l.loan_id
             LEFT JOIN users ug ON lg.guarantor_id = ug.user_id
             WHERE l.chama_id = $1
             ORDER BY l.created_at ASC, lg.id ASC`,
            [chamaId]
        );

        const rows = result.rows || [];

        const headers = [
            'loan_id',
            'chama_id',
            'borrower_name',
            'loan_amount',
            'interest_rate',
            'interest_type',
            'total_repayable',
            'amount_paid',
            'loan_status',
            'principal_outstanding',
            'interest_outstanding',
            'penalty_outstanding',
            'loan_created_at',
            'due_date',
            'guarantor_name',
            'guarantor_id',
            'guaranteed_amount',
            'guarantee_status',
            'guarantee_created_at',
            'guarantee_responded_at',
        ];

        const escape = (val) => {
            if (val === null || val === undefined) return '';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
        };

        const lines = [];
        lines.push(headers.join(','));

        for (const r of rows) {
            lines.push([
                escape(r.loan_id),
                escape(r.chama_id),
                escape(r.borrower_name),
                escape(r.loan_amount),
                escape(r.interest_rate),
                escape(r.interest_type),
                escape(r.total_repayable),
                escape(r.amount_paid),
                escape(r.status),
                escape(r.principal_outstanding),
                escape(r.interest_outstanding),
                escape(r.penalty_outstanding),
                escape(r.loan_created_at),
                escape(r.due_date),
                escape(r.guarantor_name),
                escape(r.guarantor_id),
                escape(r.guaranteed_amount),
                escape(r.guarantee_status),
                escape(r.guarantee_created_at),
                escape(r.guarantee_responded_at),
            ].join(','));
        }

        const csv = lines.join('\n');
        const filename = `chama_${chamaId}_loans_report_${new Date().toISOString().slice(0,10)}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(csv);
    } catch (error) {
        logger.logError(error, { context: 'exportLoansReport' });
        return res.status(500).json({
            success: false,
            message: 'Error generating loans report',
        });
    }
};

module.exports = {
    getLoanConfig,
    updateLoanConfig,
    applyForLoan,
    getChamaLoans,
    getLoanGuarantors,
    getMyGuarantees,
    respondToGuarantor,
    respondToLoan,
    repayLoan,
    exportLoansReport,
};
