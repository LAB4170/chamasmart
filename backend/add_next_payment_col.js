require('dotenv').config();
const p = require('./config/db');

async function runMigration() {
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    
    console.log("Checking if next_payment_at exists...");
    const checkRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'loans' AND column_name = 'next_payment_at'
    `);

    if (checkRes.rows.length === 0) {
      console.log("Adding next_payment_at column to loans table...");
      await client.query(`
        ALTER TABLE loans 
        ADD COLUMN next_payment_at TIMESTAMP WITH TIME ZONE
      `);
      
      console.log("Populating next_payment_at for existing loans...");
      await client.query(`
        UPDATE loans 
        SET next_payment_at = created_at + interval '1 month'
        WHERE next_payment_at IS NULL
      `);
      
      console.log("Migration successful.");
    } else {
      console.log("Column already exists. Skipping ALTER.");
      
      console.log("Ensuring existing NULL values are populated...");
      await client.query(`
        UPDATE loans 
        SET next_payment_at = created_at + interval '1 month'
        WHERE next_payment_at IS NULL
      `);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Migration failed:", err);
  } finally {
    client.release();
    p.end();
  }
}

runMigration();
