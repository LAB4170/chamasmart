const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'chamasmart',
  password: process.env.DB_PASSWORD || '1234',
  port: process.env.DB_PORT || 5432,
});

async function seedBot() {
  const client = await pool.connect();
  try {
    console.log('Seeding ChamaSmart AI Support Bot...');

    const checkRes = await client.query("SELECT user_id FROM users WHERE email = 'bot@chamasmart.com'");
    
    if (checkRes.rows.length > 0) {
      console.log('✅ AI Bot already exists with ID:', checkRes.rows[0].user_id);
    } else {
      const res = await client.query(`
        INSERT INTO users (first_name, last_name, email, password_hash, is_active, auth_provider)
        VALUES ('ChamaSmart', 'AI Support', 'bot@chamasmart.com', 'n/a', true, 'LOCAL')
        RETURNING user_id
      `);
      console.log('✅ AI Bot successfully injected into the system with ID:', res.rows[0].user_id);
    }
    
  } catch (error) {
    console.error('❌ Error seeding bot:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

seedBot();
