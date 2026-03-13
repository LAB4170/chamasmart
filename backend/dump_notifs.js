const pool = require('./config/db');

async function dump() {
  try {
    const resRequest = await pool.query(`SELECT * FROM join_requests WHERE request_id = 5`);
    console.log('Join Request 5:');
    console.log(JSON.stringify(resRequest.rows, null, 2));

    const resNotifs = await pool.query(`SELECT * FROM notifications WHERE entity_id = 5 AND type = 'JOIN_REQUEST'`);
    console.log('\nNotifications for Entity ID 5:');
    console.log(JSON.stringify(resNotifs.rows, null, 2));

    const resChama5 = await pool.query(`SELECT * FROM chamas WHERE chama_id = 5`);
    console.log('\nChama 5:');
    console.log(JSON.stringify(resChama5.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

dump();
