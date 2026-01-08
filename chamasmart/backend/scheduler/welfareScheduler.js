const pool = require("../config/db");
const { sendNotification } = require("../utils/notifications");
const logger = require("../utils/logger");

/**
 * Checks for chamas with low welfare fund balances and notifies admins
 */
const checkWelfareFundHealth = async () => {
    logger.info("Starting welfare fund health check...");

    try {
        // Query to find chamas where balance is less than 3x the max payout amount
        // We join to welfare_config to find the max payout for each chama
        const query = `
            WITH MaxPayouts AS (
                SELECT chama_id, MAX(payout_amount) as max_payout
                FROM welfare_config
                WHERE is_active = true
                GROUP BY chama_id
            ),
            FundBalances AS (
                SELECT chama_id, balance
                FROM welfare_fund
            )
            SELECT 
                fb.chama_id, 
                fb.balance, 
                mp.max_payout,
                c.chama_name
            FROM FundBalances fb
            JOIN MaxPayouts mp ON fb.chama_id = mp.chama_id
            JOIN chamas c ON fb.chama_id = c.chama_id
            WHERE fb.balance < (mp.max_payout * 3)
        `;

        const { rows: lowFunds } = await pool.query(query);

        logger.info(`Found ${lowFunds.length} chamas with low welfare funds.`);

        for (const fund of lowFunds) {
            await notifyAdminsOfLowFund(fund);
        }

    } catch (error) {
        logger.error("Error in welfare fund health check:", error);
    }
};

/**
 * Sends notifications to all admins of a chama about low funds
 */
const notifyAdminsOfLowFund = async (fund) => {
    try {
        const query = `
            SELECT u.user_id 
            FROM chama_members cm
            JOIN users u ON cm.user_id = u.user_id
            WHERE cm.chama_id = $1 AND cm.role IN ('CHAIRPERSON', 'TREASURER', 'SECRETARY') AND cm.is_active = true
        `;

        const { rows: admins } = await pool.query(query, [fund.chama_id]);

        const threshold = fund.max_payout * 3;
        const message = `Alert: Welfare fund balance (KES ${Number(fund.balance).toLocaleString()}) is below recommended threshold (KES ${threshold.toLocaleString()}). Please consider a levy.`;

        for (const admin of admins) {
            await sendNotification({
                userId: admin.user_id,
                type: 'WELFARE_FUND_LOW',
                title: 'Low Welfare Fund Alert',
                message: message,
                relatedId: fund.chama_id
            });
        }

    } catch (error) {
        logger.error(`Error notifying admins for chama ${fund.chama_id}:`, error);
    }
};

module.exports = {
    checkWelfareFundHealth
};
