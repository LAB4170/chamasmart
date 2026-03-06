require('dotenv').config();
const p = require('./config/db');

async function debugLoans() {
  try {
    const res = await p.query("SELECT loan_id, chama_id, borrower_id, status FROM loans");
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    p.end();
  }
}

debugLoans();
