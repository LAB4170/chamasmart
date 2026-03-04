const NodeCache = require('node-cache');

// Initialize cache with 5 minutes (300 seconds) standard TTL
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Standard utility to clear chama-related cache.
 * All controllers should use this to ensure consistency.
 * 
 * @param {string|number} chamaId - The ID of the chama to clear cache for
 */
const clearChamaCache = (chamaId) => {
  if (chamaId) {
    cache.del(`chama_${chamaId}`);
    cache.del(`chama_stats_${chamaId}`);
    cache.del(`chama_members_${chamaId}`);
    cache.del(`chama_asca_equity_${chamaId}`);
  }
  // Also clear general lists
  cache.del('all_chamas');
  cache.del('public_chamas');
};

module.exports = {
  cache,
  clearChamaCache
};
