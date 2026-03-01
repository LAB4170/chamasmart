const pool = require('./config/db');

async function checkNotifications() {
    try {
        const res = await pool.query(`
            SELECT n.notification_id, n.type, n.title, n.message, u.first_name, u.last_name 
            FROM notifications n
            JOIN users u ON n.user_id = u.user_id
            ORDER BY n.created_at DESC LIMIT 10
        `);
        console.log("Recent Notifications:");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

checkNotifications();
