const pool = require('./config/db');

async function checkSchema() {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chama_invites'
    `);
        console.log('--- chama_invites Schema ---');
        console.table(res.rows);

        const res2 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chama_members'
    `);
        console.log('--- chama_members Schema ---');
        console.table(res2.rows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
