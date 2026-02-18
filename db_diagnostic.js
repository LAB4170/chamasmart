const pool = require('./backend/config/db');

const diagnostic = async () => {
    try {
        const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
        console.log('--- TABLES ---');
        console.log(tables.rows.map(r => r.table_name).join(', '));

        for (const tableName of ['memberships', 'chama_members']) {
            const exists = tables.rows.some(r => r.table_name === tableName);
            if (exists) {
                const cols = await pool.query(`
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_name = $1
        `, [tableName]);
                console.log(`--- COLUMNS FOR ${tableName} ---`);
                cols.rows.forEach(c => console.log(`${c.column_name}: ${c.data_type}`));
            }
        }
    } catch (err) {
        console.error('Diagnostic failed:', err);
    } finally {
        pool.end();
    }
};

diagnostic();
