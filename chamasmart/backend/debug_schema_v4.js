const pool = require('./config/db');

async function checkRows() {
    try {
        const res = await pool.query(`SELECT * FROM notifications LIMIT 1`);
        if (res.rows.length > 0) {
            console.log('--- Notification Sample ---');
            console.log(Object.keys(res.rows[0]));
        } else {
            console.log('No notifications found to inspect.');
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkRows();
