const cron = require('node-cron');
const pool = require('./config/db');
const { v4: uuidv4 } = require('uuid');
const logger = require('./utils/logger');
const { createNotification } = require('./utils/notificationService');

const initScheduler = () => {
    // Run every day at midnight
    cron.schedule('0 0 * * *', async () => {
        logger.info('Running daily scheduler: ROSCA penalties and loan checks...');
        await checkAndApplyPenalties();
        await checkLoanInstallments();
    });

    // For development (optional): Run every minute or just run once on start
    // checkAndApplyPenalties();
    // checkLoanInstallments();
};

const checkAndApplyPenalties = async () => {
    // Safety Wrapper
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Get all active ROSCA cycles where auto-penalties are enabled
            // We join chamas to check the constitution_config
            const cycles = await client.query(`
                SELECT rc.*, c.constitution_config 
                FROM rosca_cycles rc
                JOIN chamas c ON rc.chama_id = c.chama_id
                WHERE rc.status = 'ACTIVE' 
                AND (c.constitution_config->'late_payment'->>'enabled')::boolean = true
            `);

            for (const cycle of cycles.rows) {
                const config = cycle.constitution_config.late_payment;
                const gracePeriod = parseInt(config.grace_period_days) || 0;
                const penaltyAmount = parseFloat(config.amount) || 0;

                // 2. Find unpaid roster entries that are overdue
                // Logic: 
                // - Contribution matched to cycle must exist
                // - If not, and date > start_date + position_weeks + grace_period?
                // Simplified Logic for "Periodic Payments":
                // Assuming "Monthly" means everyone pays by a certain day of month?
                // OR for ROSCA: Everyone must pay BEFORE the meeting/payout date.

                // Let's assume for ROSCA:
                // Roster Position 1 is eating. Everyone else must have paid for THIS round.
                // We need to know the "Due Date" for the current round.
                // If cycle started Jan 1st Monthly:
                // Round 1 (Pos 1): Due Jan 1st.
                // Round 2 (Pos 2): Due Feb 1st.

                // Calculate current round number based on start_date and frequency
                const startDate = new Date(cycle.start_date);
                const now = new Date();

                // TODO: More robust date logic needed for production, but this is a starter
                // Find the active/pending roster item that SHOULD be paid now?
                // Actually, simplest check:
                // Find all roster items where status='PENDING' 
                // AND we are past the due date for this cycle's current round?

                // Alternative simple approach for MVP:
                // Just check if there are people who haven't contributed for the *current active* round
                // But we need to track "Current Round".
                // Let's stick to the user's prompt: "If a contribution is not received by the deadline"

                // Let's define "Deadline" as the cycle start_date + (round_number * frequency)

            }

            // ... Implementation to be fleshed out ...
            // For now, logging to ensure it runs without crashing
            if (cycles.rows.length > 0) {
                logger.debug(`Checking ROSCA penalties for ${cycles.rows.length} cycles`);
            }

            await client.query('COMMIT');
        } catch (dbError) {
            await client.query('ROLLBACK');
            logger.error('Database error in penalty scheduler', {
                error: dbError.message,
                stack: dbError.stack,
            });
        } finally {
            client.release();
        }
    } catch (fatalError) {
        logger.error('FATAL error in penalty scheduler (Connection/System)', {
            error: fatalError.message,
            stack: fatalError.stack,
        });
    }
};

/**
 * Loan installment checks for Table Banking.
 * - Sends reminders 3 days before due date.
 * - Marks overdue installments and applies simple penalties.
 * - Marks loans as DEFAULTED when overdue beyond configured threshold.
 */
const checkLoanInstallments = async () => {
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const now = new Date();
            const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

            // --- 1. Send reminders 3 days before due date ---
            const reminderRes = await client.query(
                `SELECT li.id AS installment_id,
                        li.loan_id,
                        li.due_date,
                        li.amount,
                        l.borrower_id,
                        l.chama_id
                 FROM loan_installments li
                 JOIN loans l ON li.loan_id = l.loan_id
                 JOIN chamas c ON l.chama_id = c.chama_id
                 WHERE li.status = 'PENDING'
                   AND l.status = 'ACTIVE'
                   AND li.due_date = (CURRENT_DATE + INTERVAL '3 days')`
            );

            for (const inst of reminderRes.rows) {
                await createNotification(client, {
                    userId: inst.borrower_id,
                    type: 'LOAN_INSTALLMENT_REMINDER',
                    title: 'Upcoming installment due',
                    message: `You have an installment of KES ${Number(inst.amount).toFixed(2)} due on ${inst.due_date.toISOString().slice(0, 10)}.`,
                    relatedId: inst.loan_id,
                });
            }

            // --- 2. Mark overdue installments and apply penalties ---
            // Simple rule: if due_date < today and status is PENDING => OVERDUE + penalty
            const overdueRes = await client.query(
                `SELECT li.id AS installment_id,
                        li.loan_id,
                        li.due_date,
                        li.amount,
                        li.penalty_amount,
                        l.borrower_id,
                        l.chama_id,
                        l.penalty_outstanding,
                        c.constitution_config
                 FROM loan_installments li
                 JOIN loans l ON li.loan_id = l.loan_id
                 JOIN chamas c ON l.chama_id = c.chama_id
                 WHERE li.status = 'PENDING'
                   AND l.status = 'ACTIVE'
                   AND li.due_date < CURRENT_DATE`
            );

            for (const row of overdueRes.rows) {
                const config = row.constitution_config || {};
                const loanConfig = (config.loan && config.loan.penalty) || {};

                const flatPenalty = Number(loanConfig.flat_amount) || 0;
                const ratePenalty = Number(loanConfig.rate_percent) || 0;
                let penalty = flatPenalty;

                if (ratePenalty > 0) {
                    penalty += (Number(row.amount) || 0) * (ratePenalty / 100);
                }

                // If no penalty configured, skip financial impact but still mark overdue
                penalty = Number(penalty.toFixed(2));

                await client.query(
                    `UPDATE loan_installments
                     SET status = 'OVERDUE',
                         penalty_amount = COALESCE(penalty_amount, 0) + $1
                     WHERE id = $2`,
                    [penalty, row.installment_id]
                );

                if (penalty > 0) {
                    await client.query(
                        `UPDATE loans
                         SET penalty_outstanding = COALESCE(penalty_outstanding, 0) + $1
                         WHERE loan_id = $2`,
                        [penalty, row.loan_id]
                    );
                }

                await createNotification(client, {
                    userId: row.borrower_id,
                    type: 'LOAN_INSTALLMENT_OVERDUE',
                    title: 'Installment overdue',
                    message: `Your installment of KES ${Number(row.amount).toFixed(2)} is overdue. A penalty may apply.`,
                    relatedId: row.loan_id,
                });
            }

            // --- 3. Mark loans as DEFAULTED after threshold ---
            // Threshold in days from constitution_config.loan.default_threshold_days (fallback 30)
            const defaultRes = await client.query(
                `SELECT DISTINCT l.loan_id,
                        l.chama_id,
                        l.borrower_id,
                        c.constitution_config,
                        MAX(li.due_date) AS last_due_date
                 FROM loans l
                 JOIN loan_installments li ON li.loan_id = l.loan_id
                 JOIN chamas c ON l.chama_id = c.chama_id
                 WHERE l.status = 'ACTIVE'
                   AND li.status = 'OVERDUE'
                 GROUP BY l.loan_id, l.chama_id, l.borrower_id, c.constitution_config`
            );

            for (const row of defaultRes.rows) {
                const config = row.constitution_config || {};
                const loanCfg = config.loan || {};
                const thresholdDays = parseInt(loanCfg.default_threshold_days, 10) || 30;

                const lastDue = new Date(row.last_due_date);
                const diffMs = now - lastDue;
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                if (diffDays >= thresholdDays) {
                    await client.query(
                        "UPDATE loans SET status = 'DEFAULTED' WHERE loan_id = $1",
                        [row.loan_id]
                    );

                    await createNotification(client, {
                        userId: row.borrower_id,
                        type: 'LOAN_DEFAULTED',
                        title: 'Loan defaulted',
                        message: 'Your loan has been marked as defaulted due to prolonged non-payment.',
                        relatedId: row.loan_id,
                    });
                }
            }

            await client.query('COMMIT');
        } catch (dbError) {
            await client.query('ROLLBACK');
            logger.error('Database error in loan installment scheduler', {
                error: dbError.message,
                stack: dbError.stack,
            });
        } finally {
            client.release();
        }
    } catch (fatalError) {
        logger.error('FATAL error in loan installment scheduler (Connection/System)', {
            error: fatalError.message,
            stack: fatalError.stack,
        });
    }
};

/**
 * Simplified MVP Logic for Auto-Penalties:
 * 1. Find users who have NOT made a contribution for the CURRENT month/period.
 * 2. If Today > Meeting Day + Grace Period, penalize them.
 */

module.exports = { initScheduler };
