const pool = require('../config/db');

async function check() {
    try {
        console.log('Checking connection...');
        const now = await pool.query('SELECT NOW()');
        console.log('Connected:', now.rows[0]);

        console.log('Checking users table...');
        const users = await pool.query("SELECT to_regclass('public.users') as exists");
        console.log('Users table exists:', users.rows[0].exists !== null);

        if (users.rows[0].exists) {
            const passwordHistory = await pool.query("SELECT to_regclass('public.password_history') as exists");
            console.log('Password history table exists:', passwordHistory.rows[0].exists !== null);
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

check();
