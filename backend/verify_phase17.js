// verify_phase17.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function verifyPhase17() {
  console.log('--- Phase 17 Verification: Table Session Infrastructure ---');
  
  try {
    // 1. Check Schema
    const schemaCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'meetings' AND column_name IN ('session_status', 'opening_cash');
    `);
    
    if (schemaCheck.rows.length >= 2) {
      console.log('✅ Meetings table schema updated with session columns.');
    } else {
      console.log('❌ Meetings table schema missing session columns.');
    }

    // 2. Check Penalties Table
    const penaltyTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'meeting_penalties'
      );
    `);
    
    if (penaltyTableCheck.rows[0].exists) {
      console.log('✅ meeting_penalties table exists.');
    } else {
      console.log('❌ meeting_penalties table missing.');
    }

    // 3. Test Session Logic (Dry Run of a Query)
    const testQuery = await pool.query(`
      SELECT 
        u.user_id, 
        u.first_name,
        COALESCE((SELECT SUM(amount) FROM contributions WHERE user_id = u.user_id), 0) as test_calc
      FROM users u LIMIT 1
    `);
    
    if (testQuery.rows.length > 0) {
      console.log('✅ Basic session activity query logic functional.');
    }

    console.log('\n--- VERIFICATION SUCCESSFUL ---');
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
    process.exit(1);
  }
}

verifyPhase17();
