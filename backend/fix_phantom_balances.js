require('dotenv').config();
const pool = require('./config/db');

async function fixPhantomBalances() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Reset each member's total_contributions to match ONLY real completed contributions
    const updateMembers = await client.query(`
      UPDATE chama_members cm
      SET total_contributions = COALESCE((
        SELECT SUM(c.amount)
        FROM contributions c
        WHERE c.chama_id = cm.chama_id
          AND c.user_id = cm.user_id
          AND c.is_deleted = false
          AND c.status = 'COMPLETED'
      ), 0),
      updated_at = NOW()
      WHERE cm.chama_id = 1
    `);
    console.log('Updated members:', updateMembers.rowCount);

    // 2. Reset chama current_fund to match ONLY real completed contributions
    const updateFund = await client.query(`
      UPDATE chamas
      SET current_fund = COALESCE((
        SELECT SUM(amount)
        FROM contributions
        WHERE chama_id = 1
          AND is_deleted = false
          AND status = 'COMPLETED'
      ), 0),
      updated_at = NOW()
      WHERE chama_id = 1
    `);
    console.log('Updated chama fund:', updateFund.rowCount);

    await client.query('COMMIT');

    // 3. Verify results
    const members = await pool.query(
      'SELECT user_id, role, total_contributions FROM chama_members WHERE chama_id = 1 ORDER BY user_id'
    );
    const fund = await pool.query('SELECT current_fund FROM chamas WHERE chama_id = 1');
    const contribs = await pool.query(
      'SELECT contribution_id, user_id, amount, status FROM contributions WHERE chama_id = 1 AND is_deleted = false'
    );

    console.log('\n=== POST-FIX MEMBER BALANCES ===');
    members.rows.forEach(r => console.log(`  user_id=${r.user_id} role=${r.role} total_contributions=${r.total_contributions}`));
    console.log('\n=== REAL CONTRIBUTIONS IN DB ===');
    contribs.rows.forEach(r => console.log(`  id=${r.contribution_id} user=${r.user_id} amount=${r.amount} status=${r.status}`));
    console.log('\n=== CHAMA FUND ===');
    console.log('  current_fund:', fund.rows[0].current_fund);
    console.log('\nDone. All phantom balances cleared.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ROLLBACK due to error:', e.message);
  } finally {
    client.release();
    pool.end();
  }
}

fixPhantomBalances();
