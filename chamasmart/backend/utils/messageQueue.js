const Bull = require('bull');
const logger = require('../utils/logger');
const cache = require('../config/cache');

/**
 * Message Queue Manager using Bull (Redis-backed)
 * Handles async processing for notifications, emails, and background jobs
 */

// Queue configurations
const queueConfig = {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
    },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500, // Keep last 500 failed jobs
    },
};

// Create queues
const queues = {
    notifications: new Bull('notifications', queueConfig),
    emails: new Bull('emails', queueConfig),
    analytics: new Bull('analytics', queueConfig),
    reports: new Bull('reports', queueConfig),
};

// ============================================================================
// NOTIFICATION QUEUE
// ============================================================================

queues.notifications.process(async (job) => {
    const { userId, chamaId, type, data } = job.data;

    logger.info('Processing notification job', {
        jobId: job.id,
        userId,
        chamaId,
        type,
    });

    try {
        const { getIo } = require('../socket');
        const io = getIo();

        // Send real-time notification via Socket.io
        if (userId) {
            io.to(`user_${userId}`).emit('notification', {
                type,
                data,
                timestamp: new Date().toISOString(),
            });
        }

        // Also send to chama room if applicable
        if (chamaId) {
            io.to(`chama_${chamaId}`).emit('notification', {
                type,
                data,
                timestamp: new Date().toISOString(),
            });
        }

        // Store notification in database for history
        const pool = require('../config/db');
        await pool.query(
            `INSERT INTO notifications (user_id, chama_id, type, message, data, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
            [userId, chamaId, type, data.message, JSON.stringify(data)]
        );

        logger.info('Notification sent successfully', {
            jobId: job.id,
            userId,
            type,
        });

        return { success: true };
    } catch (error) {
        logger.error('Notification job failed', {
            jobId: job.id,
            error: error.message,
            userId,
            type,
        });
        throw error;
    }
});

// ============================================================================
// EMAIL QUEUE
// ============================================================================

queues.emails.process(async (job) => {
    const { to, subject, html, text } = job.data;

    logger.info('Processing email job', {
        jobId: job.id,
        to,
        subject,
    });

    try {
        const emailService = require('../utils/emailService');

        await emailService.sendEmail({
            to,
            subject,
            html,
            text,
        });

        logger.info('Email sent successfully', {
            jobId: job.id,
            to,
            subject,
        });

        return { success: true, sentAt: new Date().toISOString() };
    } catch (error) {
        logger.error('Email job failed', {
            jobId: job.id,
            error: error.message,
            to,
            subject,
        });
        throw error;
    }
});

// ============================================================================
// ANALYTICS QUEUE
// ============================================================================

queues.analytics.process(async (job) => {
    const { event, userId, chamaId, data } = job.data;

    logger.debug('Processing analytics event', {
        jobId: job.id,
        event,
        userId,
        chamaId,
    });

    try {
        // Store analytics event
        const pool = require('../config/db');
        await pool.query(
            `INSERT INTO analytics_events (event_type, user_id, chama_id, event_data, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
            [event, userId, chamaId, JSON.stringify(data)]
        );

        // Update aggregated statistics
        if (event === 'contribution_made') {
            await cache.invalidate(`stats:chama:${chamaId}*`);
            await cache.invalidate(`stats:user:${userId}*`);
        }

        return { success: true };
    } catch (error) {
        logger.error('Analytics job failed', {
            jobId: job.id,
            error: error.message,
            event,
        });
        // Don't throw - analytics failures shouldn't break the app
        return { success: false, error: error.message };
    }
});

// ============================================================================
// REPORTS QUEUE
// ============================================================================

queues.reports.process(async (job) => {
    const { reportType, chamaId, userId, params } = job.data;

    logger.info('Processing report generation', {
        jobId: job.id,
        reportType,
        chamaId,
    });

    try {
        const pool = require('../config/db');
        let reportData;

        switch (reportType) {
            case 'monthly_contributions':
                reportData = await pool.query(
                    `SELECT u.first_name, u.last_name, SUM(c.amount) as total
           FROM contributions c
           JOIN users u ON c.user_id = u.user_id
           WHERE c.chama_id = $1 
           AND c.contribution_date >= DATE_TRUNC('month', CURRENT_DATE)
           GROUP BY u.user_id, u.first_name, u.last_name
           ORDER BY total DESC`,
                    [chamaId]
                );
                break;

            case 'loan_summary':
                reportData = await pool.query(
                    `SELECT u.first_name, u.last_name, l.loan_amount, l.total_repayable, 
                  l.amount_paid, l.status, l.due_date
           FROM loans l
           JOIN users u ON l.borrower_id = u.user_id
           WHERE l.chama_id = $1
           ORDER BY l.created_at DESC`,
                    [chamaId]
                );
                break;

            default:
                throw new Error(`Unknown report type: ${reportType}`);
        }

        // Store report in cache for retrieval
        const reportId = `report:${job.id}`;
        await cache.set(reportId, {
            type: reportType,
            data: reportData.rows,
            generatedAt: new Date().toISOString(),
            chamaId,
        }, 3600); // Cache for 1 hour

        logger.info('Report generated successfully', {
            jobId: job.id,
            reportType,
            rowCount: reportData.rows.length,
        });

        return { success: true, reportId, rowCount: reportData.rows.length };
    } catch (error) {
        logger.error('Report generation failed', {
            jobId: job.id,
            error: error.message,
            reportType,
        });
        throw error;
    }
});

// ============================================================================
// QUEUE EVENT HANDLERS
// ============================================================================

Object.entries(queues).forEach(([name, queue]) => {
    queue.on('completed', (job, result) => {
        logger.debug(`Queue ${name} job completed`, {
            jobId: job.id,
            result,
        });
    });

    queue.on('failed', (job, error) => {
        logger.error(`Queue ${name} job failed`, {
            jobId: job.id,
            error: error.message,
            attempts: job.attemptsMade,
        });
    });

    queue.on('stalled', (job) => {
        logger.warn(`Queue ${name} job stalled`, {
            jobId: job.id,
        });
    });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Add notification to queue
 */
async function queueNotification(userId, chamaId, type, data) {
    return await queues.notifications.add({
        userId,
        chamaId,
        type,
        data,
    }, {
        priority: type === 'urgent' ? 1 : 5,
    });
}

/**
 * Add email to queue
 */
async function queueEmail(to, subject, html, text) {
    return await queues.emails.add({
        to,
        subject,
        html,
        text,
    }, {
        priority: 3,
    });
}

/**
 * Add analytics event to queue
 */
async function queueAnalytics(event, userId, chamaId, data) {
    return await queues.analytics.add({
        event,
        userId,
        chamaId,
        data,
    }, {
        priority: 10, // Low priority
    });
}

/**
 * Add report generation to queue
 */
async function queueReport(reportType, chamaId, userId, params = {}) {
    return await queues.reports.add({
        reportType,
        chamaId,
        userId,
        params,
    }, {
        priority: 5,
    });
}

/**
 * Get queue statistics
 */
async function getQueueStats() {
    const stats = {};

    for (const [name, queue] of Object.entries(queues)) {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
        ]);

        stats[name] = {
            waiting,
            active,
            completed,
            failed,
            delayed,
            total: waiting + active + completed + failed + delayed,
        };
    }

    return stats;
}

/**
 * Graceful shutdown
 */
async function closeQueues() {
    logger.info('Closing message queues...');

    for (const [name, queue] of Object.entries(queues)) {
        await queue.close();
        logger.info(`Queue ${name} closed`);
    }
}

module.exports = {
    queues,
    queueNotification,
    queueEmail,
    queueAnalytics,
    queueReport,
    getQueueStats,
    closeQueues,
};
