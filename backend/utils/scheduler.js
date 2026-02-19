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

                // Notify members for each activated cycle
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

    logger.info('ROSCA Scheduler initialized.');
};

module.exports = {
    initScheduler
};
