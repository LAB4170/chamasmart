const pool = require('../config/db');

const verifySchema = async () => {
    try {
        console.log('Verifying database schema...');

        // Check chamas table for invite_code
        const chamasRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chamas' AND column_name = 'invite_code';
    `);

        if (chamasRes.rows.length > 0) {
            console.log('✅ chamas.invite_code exists');
        } else {
            console.error('❌ chamas.invite_code MISSING');
        }

        // Check chama_members table for is_active
        const membersRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chama_members' AND column_name = 'is_active';
    `);

        if (membersRes.rows.length > 0) {
            console.log('✅ chama_members.is_active exists');
        } else {
            console.error('❌ chama_members.is_active MISSING');
        }

        // Check users table for trust_score (referenced in roscaController)
        const usersRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'trust_score';
    `);

        if (usersRes.rows.length > 0) {
            console.log('✅ users.trust_score exists');
        } else {
            console.log('⚠️ users.trust_score MISSING (Might cause issues in ROSCA extraction)');
        }

        process.exit(0);
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
};

verifySchema();
