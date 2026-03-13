const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'chamasmart',
  password: '1234',
  port: 5432,
});

async function run() {
  try {
    console.log("--- RECENT NOTIFICATIONS ---");
    const notifs = await pool.query(`
      SELECT notification_id, user_id, type, title, link, entity_id, created_at 
      FROM notifications 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    console.log(JSON.stringify(notifs.rows, null, 2));

    console.log("\n--- RECENT JOIN REQUESTS ---");
    const requests = await pool.query(`
      SELECT request_id, chama_id, user_id, status, created_at 
      FROM join_requests 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    console.log(JSON.stringify(requests.rows, null, 2));

    console.log("\n--- CHAMA ID 5 INFO ---");
    const chama5 = await pool.query("SELECT * FROM chamas WHERE chama_id = 5");
    console.log(JSON.stringify(chama5.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
