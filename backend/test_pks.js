const pool = require('./config/db');

async function test() {
  try {
    const q = `
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE c.contype = 'p' AND (c.conrelid::regclass::text IN ('meetings', 'users'))
    `;
    const res = await pool.query(q);
    console.log("Primary Keys:", res.rows);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
}
test();
