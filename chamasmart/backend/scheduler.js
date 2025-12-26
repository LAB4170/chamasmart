const cron = require('node-cron');
const pool = require('./config/db');
const { v4: uuidv4 } = require('uuid');

const initScheduler = () => {
    // Run every day at midnight
    cron.schedule('0 0 * * *', async () => {
        console.log('Running daily penalty check...');
        await checkAndApplyPenalties();
    });

    // For development (optional): Run every minute or just run once on start
    // checkAndApplyPenalties(); 
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
                // console.log(`Checking penalties for ${cycles.rows.length} cycles`);
            }

            await client.query('COMMIT');
        } catch (dbError) {
            await client.query('ROLLBACK');
            console.error('Database error in penalty scheduler:', dbError.message);
        } finally {
            client.release();
        }
    } catch (fatalError) {
        console.error('FATAL error in penalty scheduler (Connection/System):', fatalError.message);
    }
};

/**
 * Simplified MVP Logic for Auto-Penalties:
 * 1. Find users who have NOT made a contribution for the CURRENT month/period.
 * 2. If Today > Meeting Day + Grace Period, penalize them.
 */

module.exports = { initScheduler };
