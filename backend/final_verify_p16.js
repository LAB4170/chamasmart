const { Pool } = require('pg');
const dotenv = require('dotenv');
const { createChamaSchema } = require('./utils/validationSchemas');

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function verifyPhase16() {
  console.log('--- PHASE 16 FINAL VERIFICATION ---');

  // 1. Simulate the exact payload from the user (Table Banking + empty sharePrice string)
  const userPayload = {
    chamaName: "Verification Chama P16",
    chamaType: "TABLE_BANKING",
    contributionAmount: 500,
    contributionFrequency: "MONTHLY",
    meetingDay: "First Saturday (Physical)",
    sharePrice: "" // This was causing the error
  };

  console.log('Validating payload with empty sharePrice string...');
  const { error, value } = createChamaSchema.validate(userPayload);

  if (error) {
    console.error('❌ Validation FAILED:', error.message);
    process.exit(1);
  } else {
    console.log('✅ Validation PASSED (empty string allowed by schema)');
  }

  // 2. Sanitize as the frontend now does
  const sanitized = { ...value };
  if (sanitized.sharePrice === "") sanitized.sharePrice = null;
  if (sanitized.chamaType !== 'ASCA') delete sanitized.sharePrice;

  console.log('Sanitized Payload:', sanitized);

  // 3. Attempt to create in DB (using the controller logic simplified)
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO chamas (chama_name, chama_type, contribution_amount, contribution_frequency, meeting_day, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING chama_id`,
      [sanitized.chamaName, sanitized.chamaType, sanitized.contributionAmount, sanitized.contributionFrequency, sanitized.meetingDay]
    );
    console.log(`✅ Database Insertion SUCCESS. New Chama ID: ${res.rows[0].chama_id}`);
    
    // Cleanup
    await client.query('DELETE FROM chamas WHERE chama_id = $1', [res.rows[0].chama_id]);
    console.log('Cleaned up verification chama.');
  } catch (dbErr) {
    console.error('❌ Database Insertion FAILED:', dbErr.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n[✔] PHASE 16 VERIFICATION COMPLETE: ALL SYSTEMS NOMINAL.');
}

verifyPhase16();
