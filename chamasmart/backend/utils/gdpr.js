const pool = require('../config/db');
const logger = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/encryption');

/**
 * GDPR Compliance Utilities
 * Implements data privacy and protection features
 */

/**
 * Export user data (GDPR Right to Access)
 * @param {number} userId - User ID
 * @returns {Object} - All user data
 */
async function exportUserData(userId) {
    try {
        // Get user profile
        const userResult = await pool.query(
            'SELECT * FROM users WHERE user_id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }

        const user = userResult.rows[0];

        // Get user's chamas
        const chamasResult = await pool.query(
            `SELECT c.*, cm.role, cm.join_date
       FROM chamas c
       INNER JOIN chama_members cm ON c.chama_id = cm.chama_id
       WHERE cm.user_id = $1`,
            [userId]
        );

        // Get user's contributions
        const contributionsResult = await pool.query(
            'SELECT * FROM contributions WHERE user_id = $1',
            [userId]
        );

        // Get user's loans
        const loansResult = await pool.query(
            'SELECT * FROM loans WHERE borrower_id = $1',
            [userId]
        );

        // Get user's meetings attendance
        const meetingsResult = await pool.query(
            'SELECT * FROM meeting_attendance WHERE user_id = $1',
            [userId]
        );

        // Get audit logs
        const auditResult = await pool.query(
            'SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1000',
            [userId]
        );

        // Remove sensitive fields
        delete user.password;

        const exportData = {
            exportDate: new Date().toISOString(),
            user,
            chamas: chamasResult.rows,
            contributions: contributionsResult.rows,
            loans: loansResult.rows,
            meetings: meetingsResult.rows,
            auditLogs: auditResult.rows,
        };

        logger.info('User data exported', { userId });

        return exportData;
    } catch (error) {
        logger.error('Failed to export user data', {
            userId,
            error: error.message,
        });
        throw error;
    }
}

/**
 * Delete user data (GDPR Right to Erasure)
 * @param {number} userId - User ID
 * @param {boolean} hardDelete - Permanently delete or soft delete
 */
async function deleteUserData(userId, hardDelete = false) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        if (hardDelete) {
            // Permanently delete all user data
            await client.query('DELETE FROM meeting_attendance WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM loan_repayments WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM loans WHERE borrower_id = $1', [userId]);
            await client.query('DELETE FROM contributions WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM chama_members WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM chama_invites WHERE invitee_email = (SELECT email FROM users WHERE user_id = $1)', [userId]);
            await client.query('DELETE FROM audit_logs WHERE user_id = $1', [userId]);
            await client.query('DELETE FROM users WHERE user_id = $1', [userId]);

            logger.warn('User data permanently deleted', { userId });
        } else {
            // Soft delete - anonymize user data
            const anonymousEmail = `deleted_${userId}_${Date.now()}@deleted.com`;

            await client.query(
                `UPDATE users 
         SET email = $1, 
             first_name = 'Deleted',
             last_name = 'User',
             phone_number = NULL,
             is_active = false,
             deleted_at = NOW()
         WHERE user_id = $2`,
                [anonymousEmail, userId]
            );

            logger.info('User data anonymized', { userId });
        }

        await client.query('COMMIT');

        return { success: true };
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Failed to delete user data', {
            userId,
            error: error.message,
        });
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Get user consent status
 * @param {number} userId - User ID
 */
async function getUserConsent(userId) {
    const result = await pool.query(
        'SELECT privacy_consent, marketing_consent, data_sharing_consent, consent_date FROM users WHERE user_id = $1',
        [userId]
    );

    if (result.rows.length === 0) {
        throw new Error('User not found');
    }

    return result.rows[0];
}

/**
 * Update user consent
 * @param {number} userId - User ID
 * @param {Object} consent - Consent preferences
 */
async function updateUserConsent(userId, consent) {
    const {
        privacyConsent,
        marketingConsent,
        dataSharingConsent,
    } = consent;

    await pool.query(
        `UPDATE users 
     SET privacy_consent = $1,
         marketing_consent = $2,
         data_sharing_consent = $3,
         consent_date = NOW()
     WHERE user_id = $4`,
        [privacyConsent, marketingConsent, dataSharingConsent, userId]
    );

    logger.info('User consent updated', { userId, consent });

    return { success: true };
}

/**
 * Anonymize old data (GDPR data minimization)
 * @param {number} retentionDays - Days to retain data
 */
async function anonymizeOldData(retentionDays = 365) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        // Anonymize old audit logs
        const result = await pool.query(
            `UPDATE audit_logs
       SET ip_address = NULL,
           user_agent = NULL,
           changes = '{}'::jsonb
       WHERE created_at < $1
       AND ip_address IS NOT NULL`,
            [cutoffDate]
        );

        logger.info('Old data anonymized', {
            retentionDays,
            rowsAffected: result.rowCount,
        });

        return { rowsAffected: result.rowCount };
    } catch (error) {
        logger.error('Failed to anonymize old data', {
            error: error.message,
        });
        throw error;
    }
}

/**
 * Add consent columns to users table if not exists
 */
async function addConsentColumns() {
    try {
        await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS privacy_consent BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS data_sharing_consent BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS consent_date TIMESTAMP,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

      CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
    `);

        logger.info('GDPR consent columns added/verified');
    } catch (error) {
        logger.error('Failed to add consent columns', {
            error: error.message,
        });
    }
}

// Add columns on module load
addConsentColumns();

module.exports = {
    exportUserData,
    deleteUserData,
    getUserConsent,
    updateUserConsent,
    anonymizeOldData,
};
