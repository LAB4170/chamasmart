/**
 * Phase 4: ROSCA Critical Logic Audit
 * Validates: cycle creation, payout calculation, contribution linking, and roster integrity
 */
const pool = require('./config/db');

async function audit() {
  console.log('\n=== ROSCA LOGIC AUDIT ===\n');

  // 1. Check all contributions with cycle_id properly set
  const cycleLinked = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE cycle_id IS NOT NULL) AS linked_to_cycle,
      COUNT(*) FILTER (WHERE cycle_id IS NULL) AS unlinked,
      COUNT(*) FILTER (WHERE contribution_type = 'ROSCA_PAYOUT') AS payout_records
    FROM contributions
  `);
  const { linked_to_cycle, unlinked, payout_records } = cycleLinked.rows[0];
  console.log('Contributions:');
  console.log(`  Linked to cycle: ${linked_to_cycle}`);
  console.log(`  Unlinked (general/non-ROSCA): ${unlinked}`);
  console.log(`  ROSCA payout entries: ${payout_records}`);

  // 2. Check for cycles with roster entries
  const cycleIntegrity = await pool.query(`
    SELECT 
      rc.cycle_id,
      rc.cycle_name,
      rc.status,
      rc.contribution_amount,
      COUNT(rr.roster_id) AS roster_count,
      COUNT(rr.roster_id) FILTER (WHERE rr.status = 'PAID') AS paid_count
    FROM rosca_cycles rc
    LEFT JOIN rosca_roster rr ON rc.cycle_id = rr.cycle_id
    GROUP BY rc.cycle_id, rc.cycle_name, rc.status, rc.contribution_amount
    ORDER BY rc.created_at DESC
    LIMIT 10
  `);
  console.log('\nCycle Integrity:');
  if (cycleIntegrity.rows.length === 0) {
    console.log('  No cycles found — fresh DB');
  } else {
    cycleIntegrity.rows.forEach(row => {
      console.log(`  [${row.cycle_id}] ${row.cycle_name} (${row.status}) — Amount: ${row.contribution_amount}, Roster: ${row.roster_count} members, Paid: ${row.paid_count}`);
    });
  }

  // 3. Check for ghost payout_amount references (should be zero)
  const ghostCheck = await pool.query(`
    SELECT COUNT(*) FROM information_schema.columns 
    WHERE table_name = 'rosca_roster' AND column_name = 'payout_amount'
  `);
  const hasGhost = parseInt(ghostCheck.rows[0].count) > 0;
  console.log(`\nPhantom column 'payout_amount' in rosca_roster: ${hasGhost ? '❌ STILL EXISTS' : '✅ CONFIRMED REMOVED'}`);

  // 4. Check for transactions table (should NOT exist)
  const txCheck = await pool.query(`
    SELECT COUNT(*) FROM information_schema.tables 
    WHERE table_name = 'transactions' AND table_schema = 'public'
  `);
  const hasTx = parseInt(txCheck.rows[0].count) > 0;
  console.log(`Phantom 'transactions' table: ${hasTx ? '❌ EXISTS (needs drop)' : '✅ CONFIRMED REMOVED'}`);

  // 5. Check server routes load cleanly
  console.log('\n=== ROUTE INTEGRITY ===');
  const routes = [
    './routes/auth',
    './routes/contributions',
    './routes/roscaRoutes',
    './routes/chamas',
  ];
  for (const route of routes) {
    try {
      require(route);
      console.log(`  ✅ ${route}`);
    } catch (e) {
      console.log(`  ❌ ${route} — ${e.message}`);
    }
  }

  pool.end();
  console.log('\n=== AUDIT COMPLETE ===\n');
}

audit().catch(e => {
  console.error('Audit error:', e.message);
  pool.end();
});
