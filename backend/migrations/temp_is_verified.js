const pool = require('../config/db');

const migrate = async () => {
  try {
    console.log('Adding is_verified column to chamas table...');
    await pool.query('ALTER TABLE chamas ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;');
    console.log('Column added successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migrate();
