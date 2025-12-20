const pool = require('./config/db');

const fixSchema = async () => {
  const client = await pool.connect();
  try {
    console.log("Checking and fixing database schema...");
    await client.query('BEGIN');

    // 1. Ensure chamas table has total_members
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chamas' AND column_name='total_members') THEN 
          ALTER TABLE chamas ADD COLUMN total_members INTEGER DEFAULT 0; 
        END IF; 
      END $$;
    `);

    // 2. Ensure chama_members has rotation_position
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chama_members' AND column_name='rotation_position') THEN 
          ALTER TABLE chama_members ADD COLUMN rotation_position INTEGER; 
        END IF; 
      END $$;
    `);

    // 3. Ensure chama_invites table exists (Redundant check but safe)
    await client.query(`
      CREATE TABLE IF NOT EXISTS chama_invites (
          invite_id SERIAL PRIMARY KEY,
          chama_id INTEGER REFERENCES chamas(chama_id) ON DELETE CASCADE,
          invite_code VARCHAR(20) UNIQUE NOT NULL,
          created_by INTEGER REFERENCES users(user_id),
          max_uses INTEGER DEFAULT 1,
          uses_count INTEGER DEFAULT 0,
          expires_at TIMESTAMP,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 4. Ensure meetings table has recorded_by
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='meetings' AND column_name='recorded_by') THEN 
          ALTER TABLE meetings ADD COLUMN recorded_by INTEGER REFERENCES users(user_id); 
        END IF; 
      END $$;
    `);

    // 5. Ensure contributions table has recorded_by
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contributions' AND column_name='recorded_by') THEN 
          ALTER TABLE contributions ADD COLUMN recorded_by INTEGER REFERENCES users(user_id); 
        END IF; 
      END $$;
    `);

    // 6. Ensure Indexes exist
    await client.query(`CREATE INDEX IF NOT EXISTS idx_invite_code ON chama_invites(invite_code);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_chama_invites ON chama_invites(chama_id);`);

    await client.query('COMMIT');
    console.log("✅ Database schema verified and fixed!");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Error fixing schema:", err);
  } finally {
    client.release();
    // Close pool to allow script to exit
    pool.end();
  }
};

fixSchema();
