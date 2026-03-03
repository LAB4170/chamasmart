const pool = require('./config/db');

async function check() {
  const res = await pool.query(`
    SELECT column_name, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'rosca_cycles';
  `);
  console.log("COLUMNS:", res.rows);

  const constr = await pool.query(`
    SELECT pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'rosca_cycles' AND c.contype = 'c';
  `);
  console.log("CONSTRAINTS:", constr.rows);
  pool.end();
}

check();
