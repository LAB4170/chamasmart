const pool = require('./config/db');
const bcrypt = require('bcryptjs');

const resetPassword = async () => {
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        // Update user 2 (Lewis Bosire)
        const res = await pool.query(
            "UPDATE users SET password_hash = $1 WHERE user_id = 2 RETURNING email",
            [hashedPassword]
        );

        console.log('Password reset for:', res.rows[0].email);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

resetPassword();
