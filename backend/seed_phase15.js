const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function seedTestData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Ensure a test user exists
    const userRes = await client.query(`
      INSERT INTO users (first_name, last_name, email, password_hash)
      VALUES ('Test', 'Borrower', 'test_borrower@example.com', 'hashed')
      ON CONFLICT (email) DO UPDATE SET first_name = 'Test'
      RETURNING user_id
    `);
    const userId = userRes.rows[0].user_id;

    // 2. Create a Table Banking Chama
    const chamaRes = await client.query(`
      INSERT INTO chamas (chama_name, chama_type, contribution_amount, is_active, created_by)
      VALUES ('Test Security Chama', 'TABLE_BANKING', 1000, true, $1)
      RETURNING chama_id
    `, [userId]);
    const chamaId = chamaRes.rows[0].chama_id;

    // 3. Add the user as CHAIRPERSON
    await client.query(`
      INSERT INTO chama_members (chama_id, user_id, role, total_contributions, is_active)
      VALUES ($1, $2, 'CHAIRPERSON', 100000, true)
      ON CONFLICT (chama_id, user_id) DO UPDATE SET total_contributions = 100000, role = 'CHAIRPERSON'
    `, [chamaId, userId]);

    await client.query('COMMIT');
    console.log(`Seeded Test Data: User ID ${userId}, Chama ID ${chamaId}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

seedTestData();
