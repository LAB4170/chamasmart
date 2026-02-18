const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Manually parse .env
const envPath = path.resolve(__dirname, 'backend', '.env');
const envConfig = fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(line => line.includes('=') && !line.startsWith('#'))
    .reduce((acc, line) => {
        const [key, ...value] = line.split('=');
        acc[key.trim()] = value.join('=').trim();
        return acc;
    }, {});

const pool = new Pool({
    user: envConfig.DB_USER,
    host: envConfig.DB_HOST,
    database: envConfig.DB_NAME,
    password: envConfig.DB_PASSWORD,
    port: parseInt(envConfig.DB_PORT),
});

async function verify() {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chama_members'
    `);
        console.log("Columns in chama_members:");
        res.rows.forEach(r => console.log(`- ${r.column_name}: ${r.data_type}`));

        const hasUpdatedAt = res.rows.some(r => r.column_name === 'updated_at');
        if (hasUpdatedAt) {
            console.log("SUCCESS: updated_at column found.");
        } else {
            console.log("FAILURE: updated_at column NOT found.");
        }
    } catch (err) {
        console.error("Verification failed:", err);
    } finally {
        await pool.end();
    }
}

verify();
