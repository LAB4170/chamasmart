const pool = require('./config/db');

async function debugData() {
  try {
    const chamas = await pool.query('SELECT chama_name, current_fund FROM chamas WHERE chama_id = 1;');
    console.log("CHAMA:", chamas.rows[0]);

    const contribs = await pool.query('SELECT SUM(amount) FROM contributions WHERE chama_id = 1;');
    console.log("TOTAL CONTRIBS:", contribs.rows[0]);

    const auditController = require('./controllers/auditController');
    console.log("Audit controller exports:", Object.keys(auditController));

  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
debugData();
