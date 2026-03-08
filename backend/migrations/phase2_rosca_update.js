const pool = require('../config/db');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Adding requester_position to rosca_swap_requests...');
    await client.query(`
      ALTER TABLE rosca_swap_requests 
      ADD COLUMN IF NOT EXISTS requester_position INTEGER;
    `);

    console.log('Adding updated_at to rosca_swap_requests...');
    await client.query(`
      ALTER TABLE rosca_swap_requests 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    `);

    console.log('Cleaning up redundant constraints on rosca_roster...');
    await client.query(`
      ALTER TABLE rosca_roster 
      DROP CONSTRAINT IF EXISTS unique_cycle_position,
      DROP CONSTRAINT IF EXISTS rosca_roster_cycle_id_position_key,
      DROP CONSTRAINT IF EXISTS unique_cycle_user,
      DROP CONSTRAINT IF EXISTS rosca_roster_cycle_id_user_id_key,
      ADD CONSTRAINT unique_cycle_position UNIQUE (cycle_id, position) DEFERRABLE INITIALLY IMMEDIATE,
      ADD CONSTRAINT unique_cycle_user UNIQUE (cycle_id, user_id) DEFERRABLE INITIALLY IMMEDIATE;
    `);

    await client.query('COMMIT');
    console.log('✅ Base migration complete.');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrate();
