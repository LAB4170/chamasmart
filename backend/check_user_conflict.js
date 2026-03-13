const pool = require('./config/db');

async function checkUser() {
    try {
        const result = await pool.query('SELECT user_id, first_name, last_name, email, phone_number FROM users WHERE phone_number = $1 OR email = $2', ['+254116333053', 'lewisbosire4170@gmail.com']);
        console.log('Users found:', result.rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

checkUser();
