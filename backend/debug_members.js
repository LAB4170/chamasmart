const pool = require('./config/db');

async function checkMembers() {
    try {
        const client = await pool.connect();
        console.log("Connected to DB");

        // Get all users
        const usersRes = await client.query('SELECT user_id, email, first_name FROM users');
        console.log("Users:", usersRes.rows);

        // Get members of Chama 1
        const membersRes = await client.query('SELECT * FROM chama_members WHERE chama_id = 1');
        console.log("Members of Chama 1:", membersRes.rows);

        // Check chamas
        const chamasRes = await client.query('SELECT * FROM chamas');
        console.log("Chamas:", chamasRes.rows);

        client.release();
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

checkMembers();
