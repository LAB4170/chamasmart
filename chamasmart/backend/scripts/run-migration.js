const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Read the SQL file
    const sql = fs.readFileSync(
      path.join(__dirname, 'migrations', '006_performance_indexes.sql'),
      'utf8'
    );

    // Execute the SQL
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
