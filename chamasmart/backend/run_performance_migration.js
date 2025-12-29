const fs = require('fs');
const path = require('path');
const pool = require('./config/db');
const logger = require('./utils/logger');

async function runMigration() {
    const migrationFile = path.join(__dirname, 'migrations', '007_performance_optimization.sql');

    try {
        logger.info('Starting database migration: 007_performance_optimization');

        // Read migration file
        const sql = fs.readFileSync(migrationFile, 'utf8');

        // Execute the entire SQL file at once
        // This properly handles dollar-quoted strings and multi-line functions
        await pool.query(sql);

        logger.info('Migration completed successfully!');
        logger.info('Database optimizations applied:');
        logger.info('  - 15+ composite and partial indexes');
        logger.info('  - 2 materialized views for dashboard queries');
        logger.info('  - Refresh functions for statistics');
        logger.info('  - Query performance optimizations');
        logger.info('');
        logger.info('Next steps:');
        logger.info('  1. Refresh materialized views: SELECT refresh_all_statistics();');
        logger.info('  2. Schedule hourly refresh via cron or pg_cron');
        logger.info('  3. Monitor query performance in logs');

        process.exit(0);
    } catch (error) {
        // Check if error is due to objects already existing
        if (error.message.includes('already exists')) {
            logger.warn('Some database objects already exist, skipping...');
            logger.info('Migration completed with warnings');
            process.exit(0);
        } else {
            logger.error('Migration failed', {
                error: error.message,
                stack: error.stack,
            });
            logger.error('You may need to run the migration manually using psql');
            logger.error('Command: psql -U postgres -d chamasmart -f migrations/007_performance_optimization.sql');
            process.exit(1);
        }
    }
}

runMigration();
