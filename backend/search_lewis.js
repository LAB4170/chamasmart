const pool = require('./config/db');

async function checkUser() {
    try {
        const result = await pool.query("SELECT user_id, first_name, last_name, email, phone_number FROM users WHERE first_name ILIKE 'lewis%'");
        console.log('Users found:', result.rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

checkUser();
