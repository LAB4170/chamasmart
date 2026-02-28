const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5432, user: 'postgres', password: '1234', database: 'chamasmart' });

async function run() {
  try {
    console.log('--- ATTEMPTING INSERT ---');
    // Testing with everything except link first
    const res1 = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [2, 'TEST', 'Test Title', 'Test Message', 'TEST_ENTITY', 1]
    );
    console.log('INSERT_1_SUCCESS');

    // Testing with link
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, type, title, message, link, entity_type, entity_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [2, 'TEST_LINK', 'Test Link', 'Test Message', '/test', 'TEST_ENTITY', 2]
      );
      console.log('INSERT_2_SUCCESS');
    } catch (e2) {
      console.log('INSERT_2_FAIL:' + e2.message);
    }
  } catch (e) {
    console.log('INSERT_1_FAIL:' + e.message);
  } finally {
    await pool.end();
  }
}
run();
