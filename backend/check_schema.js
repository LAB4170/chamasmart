const pool = require('./config/db');

const checkSchema = async () => {
    try {
        const client = await pool.connect();
        const res = await client.query(`
      SELECT column_name, is_nullable, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'chamas';
    `);
        console.table(res.rows);
        client.release();
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkSchema();
