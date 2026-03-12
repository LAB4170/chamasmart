const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 5432,
});

async function testInsert() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const uid = 'mock_firebase_uid_' + Date.now();
    const email = null; // Phone auth has no email
    const firstName = 'User';
    const lastName = null; // Might be null
    const phoneNumber = '+254796874205';
    const providerId = 'phone';
    const picture = null;
    const emailVerified = false;

    console.log('Attempting to insert user...');
    const newUserResult = await client.query(
      `INSERT INTO users (
        email, first_name, last_name, phone_number, firebase_uid, 
        auth_provider, profile_picture_url, email_verified, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        email, firstName, lastName, phoneNumber, uid,
        providerId, picture, emailVerified, true,
      ],
    );
    console.log('Successfully inserted user! Rolling back...');
    await client.query('ROLLBACK');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('DB Error Details:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      table: err.table,
      constraint: err.constraint,
    });
  } finally {
    client.release();
    pool.end();
  }
}

testInsert();
