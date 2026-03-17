const logger = require('./logger');

/**
 * Share Synchronization Utility
 * Automatically converts verified contributions into ASCA/Table Banking shares.
 */
class ShareSync {
  /**
   * Synchronize a specific contribution to the share ledger
   * @param {object} client - PG Client (within a transaction)
   * @param {number} contributionId 
   */
  static async syncContributionToShares(client, contributionId) {
    try {
      // 1. Fetch contribution details and chama type
      const contribRes = await client.query(`
        SELECT c.*, ch.chama_type, ch.share_price as chama_share_price
        FROM contributions c
        JOIN chamas ch ON c.chama_id = ch.chama_id
        WHERE c.contribution_id = $1 AND c.verification_status = 'VERIFIED' AND c.is_deleted = false
      `, [contributionId]);

      if (contribRes.rowCount === 0) return null;

      const contrib = contribRes.rows[0];
      const { chama_id: chamaId, user_id: userId, amount, cycle_id, chama_type, chama_share_price } = contrib;

      // Only ASCA and TABLE_BANKING use shares/equity
      if (!['ASCA', 'TABLE_BANKING'].includes(chama_type)) return null;

      // 2. Resolve Cycle and Share Price
      let targetCycleId = cycle_id;
      let sharePrice = parseFloat(chama_share_price || 0);

      // If no cycle_id on contribution, check for active ASCA cycle
      if (!targetCycleId) {
        const cycleRes = await client.query(
          "SELECT cycle_id, share_price FROM asca_cycles WHERE chama_id = $1 AND status = 'ACTIVE' LIMIT 1",
          [chamaId]
        );
        if (cycleRes.rowCount > 0) {
          targetCycleId = cycleRes.rows[0].cycle_id;
          sharePrice = parseFloat(cycleRes.rows[0].share_price || sharePrice);
        }
      } else {
        // Get share price from the specific cycle
        const cyclePriceRes = await client.query(
          "SELECT share_price FROM asca_cycles WHERE cycle_id = $1",
          [targetCycleId]
        );
        if (cyclePriceRes.rowCount > 0) {
          sharePrice = parseFloat(cyclePriceRes.rows[0].share_price || sharePrice);
        }
      }

      // If still no share price, we can't calculate shares, but we record the investment amount
      const sharesToCredit = sharePrice > 0 ? parseFloat(amount) / sharePrice : 0;

      // 3. Prevent duplicate sync (Check if this contribution_id is already in asca_share_contributions)
      // Note: We might need to add payment_reference or similar to asca_share_contributions 
      // or just assume if we are calling this it's the first time. 
      // For robustness, let's check for existing record with same metadata if possible.
      // Since asca_share_contributions doesn't have contribution_id, let's just proceed.
      // (Recommended: Add contribution_id to asca_share_contributions for perfect tracking)

      // 4. Record share purchase in ASCA ledger
      // ON CONFLICT DO NOTHING prevents double-syncing the same contribution
      const shareInsert = await client.query(
        `INSERT INTO asca_share_contributions (user_id, chama_id, cycle_id, amount, number_of_shares, transaction_date, contribution_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (contribution_id) DO NOTHING
         RETURNING id`,
        [userId, chamaId, targetCycleId, amount, sharesToCredit, contrib.contribution_date, contributionId]
      );

      // If the row already existed (ON CONFLICT triggered), skip further updates
      if (!shareInsert.rowCount || shareInsert.rowCount === 0) {
        logger.info('Contribution already synced, skipping', { contributionId });
        return null;
      }

      // 5. Upsert into asca_members for dividend tracking
      // Only if we have a cycle
      if (targetCycleId) {
        await client.query(
          `INSERT INTO asca_members (user_id, cycle_id, shares_owned, total_investment, status)
           VALUES ($1, $2, $3, $4, 'ACTIVE')
           ON CONFLICT (user_id, cycle_id) 
           DO UPDATE SET 
             shares_owned = asca_members.shares_owned + EXCLUDED.shares_owned,
             total_investment = asca_members.total_investment + EXCLUDED.total_investment`,
          [userId, targetCycleId, sharesToCredit, amount]
        );
      }

      logger.info('Contribution synced to shares', { contributionId, shares: sharesToCredit, type: chama_type });
      return { shares: sharesToCredit, cycleId: targetCycleId };

    } catch (err) {
      logger.error('ShareSync logic failed', { error: err.message, contributionId });
      throw err;
    }
  }
}

module.exports = ShareSync;
