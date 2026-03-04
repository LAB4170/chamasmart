const { cache, clearChamaCache } = require('./utils/cache');

async function verifyMemberVisibility() {
  console.log('--- E2E Member Visibility Verification (Cache Logic) ---');
  
  const testChamaId = 1; // Assuming chama 1 exists or using as a key
  const cacheKey = `chama_members_${testChamaId}`;
  
  // 1. Simulate ChamaDetails fetching members (populating cache)
  console.log('Step 1: Populating cache for chama_members...');
  const initialMembers = [
    { user_id: 101, first_name: 'Existing', last_name: 'Member' }
  ];
  cache.set(cacheKey, initialMembers);
  console.log('Cache state:', cache.get(cacheKey));
  
  // 2. Simulate AddMember adding a new user
  console.log('\nStep 2: Simulating addMember operation in memberController...');
  // In memberController.js: await client.query("COMMIT"); clearChamaCache(chamaId);
  clearChamaCache(testChamaId);
  console.log('clearChamaCache() called for chamaId:', testChamaId);
  
  // 3. Verify cache is cleared
  console.log('\nStep 3: Verifying cache invalidation...');
  const cachedData = cache.get(cacheKey);
  
  if (cachedData === undefined) {
    console.log('✅ SUCCESS: Cache key "chama_members_1" was successfully invalidated.');
    console.log('The next request to getChamaMembers will fetch fresh data from the database.');
  } else {
    console.log('❌ FAILURE: Cache key still exists:', cachedData);
    process.exit(1);
  }

  // 4. Verify other related keys are cleared too
  const statsKey = `chama_stats_${testChamaId}`;
  cache.set(statsKey, { total: 1000 });
  console.log('\nStep 4: Verifying secondary keys (stats)...');
  clearChamaCache(testChamaId);
  if (cache.get(statsKey) === undefined) {
    console.log('✅ SUCCESS: Stats cache also invalidated.');
  } else {
    console.log('❌ FAILURE: Stats cache persisted.');
    process.exit(1);
  }
}

verifyMemberVisibility().catch(err => {
  console.error(err);
  process.exit(1);
});
