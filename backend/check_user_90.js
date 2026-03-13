const pool = require('./config/db');

async function checkUser() {
    try {
        const result = await pool.query('SELECT user_id, first_name, last_name, email, phone_number FROM users WHERE user_id = 90');
        console.log('User 90 found:', result.rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

checkUser();
