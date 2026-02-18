const pool = require('../config/db');

const runMigration = async () => {
    try {
        console.log('Running migration: Add invite_code to chamas table...');

        // Add invite_code column if it doesn't exist
        await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chamas' AND column_name = 'invite_code') THEN 
          ALTER TABLE chamas ADD COLUMN invite_code VARCHAR(10) UNIQUE; 
        END IF; 
      END $$;
    `);

        console.log('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

runMigration();
