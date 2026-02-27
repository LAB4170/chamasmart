const cron = require('node-cron');
const pool = require('../config/db');
const logger = require('./logger');

/**
 * ROSCA Background Scheduler
 * Handles automated initiation of cycles and other periodic tasks
 */

const initScheduler = () => {
    // Check for pending cycles that should start today
    // Run every hour at the top of the hour
    cron.schedule('0 * * * *', async () => {
        logger.info('Running ROSCA Activation Scheduler...');
        try {
            const result = await pool.query(
                `UPDATE rosca_cycles 
                 SET status = 'ACTIVE', 
                     updated_at = NOW() 
                 WHERE status = 'PENDING' 
                 AND start_date <= CURRENT_DATE
                 RETURNING cycle_id, cycle_name, chama_id`
            );

            if (result.rowCount > 0) {
                logger.info(`Automatically activated ${result.rowCount} ROSCA cycles.`);
                const { getIo } = require('../socket');
                const io = getIo();
                result.rows.forEach(cycle => {
                    if (io) {
                        io.to(`chama_${cycle.chama_id}`).emit('rosca_cycle_activated', {
                            cycle_id: cycle.cycle_id,
                            chama_id: cycle.chama_id,
                            cycle_name: cycle.cycle_name,
                            method: 'AUTOMATIC'
                        });
                    }
                });
            }
        } catch (error) {
            logger.error('ROSCA Activation Scheduler Failed', { error: error.message });
        }
    });

    // ROSCA Late Fee Engine - Runs daily at midnight
    cron.schedule('0 0 * * *', async () => {
        logger.info('Running ROSCA Penalty Engine...');
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Get all active ROSCA cycles and their chama constitution
            const activeCycles = await client.query(
                `SELECT rc.*, c.constitution_config 
                 FROM rosca_cycles rc
                 JOIN chamas c ON rc.chama_id = c.chama_id
                 WHERE rc.status = 'ACTIVE'`
            );

            for (const cycle of activeCycles.rows) {
                const config = cycle.constitution_config?.late_payment;
                if (!config || !config.enabled) continue;

                const penaltyAmount = parseFloat(config.amount || 0);
                const gracePeriod = parseInt(config.grace_period_days || 0);
                if (penaltyAmount <= 0) continue;

                // 2. Identify the current round
                const roundResult = await client.query(
                    `SELECT COUNT(*) as paid_count FROM rosca_roster WHERE cycle_id = $1 AND status = 'PAID'`,
                    [cycle.cycle_id]
                );
                const currentRound = parseInt(roundResult.rows[0].paid_count) + 1;

                // 3. Calculate the deadline for the current round
                const daysPerRound = cycle.frequency === 'WEEKLY' ? 7 : cycle.frequency === 'BIWEEKLY' ? 14 : 30;
                const roundStartDate = new Date(cycle.start_date);
                roundStartDate.setDate(roundStartDate.getDate() + (currentRound - 1) * daysPerRound);
                
                const deadline = new Date(roundStartDate);
                deadline.setDate(deadline.getDate() + gracePeriod);

                // If deadline hasn't passed, skip
                if (new Date() <= deadline) continue;

                // 4. Find delinquent members
                // Members who haven't contributed at least 'currentRound' times for this cycle
                const delinquentMembers = await client.query(
                    `SELECT rr.user_id, u.first_name, u.last_name
                     FROM rosca_roster rr
                     JOIN users u ON rr.user_id = u.user_id
                     WHERE rr.cycle_id = $1
                     AND (
                        SELECT COUNT(*) FROM contributions c 
                        WHERE c.cycle_id = $1 AND c.user_id = rr.user_id
                     ) < $2`,
                    [cycle.cycle_id, currentRound]
                );

                for (const member of delinquentMembers.rows) {
                    // Check if a penalty was already applied for this round
                    const existingPenalty = await client.query(
                        `SELECT 1 FROM audit_logs 
                         WHERE resource_type = 'ROSCA_PENALTY' 
                         AND resource_id = $1 
                         AND metadata->>'round' = $2`,
                        [cycle.cycle_id, currentRound.toString()]
                    );

                    if (existingPenalty.rowCount > 0) continue;

                    // Apply penalty (log it)
                    await client.query(
                        `INSERT INTO financial_audit_logs (user_id, transaction_type, amount, chama_id, status, metadata)
                         VALUES ($1, 'PENALTY', $2, $3, 'PENDING', $4)`,
                        [member.user_id, penaltyAmount, cycle.chama_id, JSON.stringify({
                            cycle_id: cycle.cycle_id,
                            round: currentRound,
                            reason: 'Late ROSCA contribution'
                        })]
                    );

                    await client.query(
                        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata)
                         VALUES ($1, 'CREATE', 'ROSCA_PENALTY', $2, $3)`,
                        [member.user_id, cycle.cycle_id, JSON.stringify({
                            round: currentRound,
                            amount: penaltyAmount,
                            member_name: `${member.first_name} ${member.last_name}`
                        })]
                    );

                    logger.info(`Applied penalty of ${penaltyAmount} to ${member.first_name} for Cycle ${cycle.cycle_id} Round ${currentRound}`);
                }
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('ROSCA Penalty Engine Failed', { error: error.message });
        } finally {
            client.release();
        }
    });

    logger.info('ROSCA Scheduler initialized.');
};

module.exports = {
    initScheduler
};
