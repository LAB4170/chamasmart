const { cache, clearChamaCache } = require('./utils/cache');
const logger = require('./utils/logger');

async function testCache() {
  const chamaId = 999;
  const key = `chama_members_${chamaId}`;
  
  console.log('--- Testing Cache Invalidation ---');
  
  // 1. Set a value
  cache.set(key, [{ id: 1, name: 'Original' }]);
  console.log('Initial cache set:', cache.get(key));
  
  // 2. Clear cache
  console.log(`Clearing cache for chama ${chamaId}...`);
  clearChamaCache(chamaId);
  
  // 3. Verify it's gone
  const result = cache.get(key);
  if (result === undefined) {
    console.log('SUCCESS: Cache was successfully invalidated!');
  } else {
    console.log('FAILURE: Cache still exists:', result);
    process.exit(1);
  }
}

testCache().catch(err => {
  console.error(err);
  process.exit(1);
});
