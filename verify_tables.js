const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Manually parse .env if dotenv fails
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
        const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log("Tables in database:", res.rows.map(r => r.table_name).join(', '));

        const memberTable = res.rows.find(r => r.table_name === 'chama_members');
        if (memberTable) {
            console.log("SUCCESS: chama_members table found.");
        } else {
            console.log("FAILURE: chama_members table NOT found.");
        }
    } catch (err) {
        console.error("Verification failed:", err);
    } finally {
        await pool.end();
    }
}

verify();
