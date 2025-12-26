const pool = require("../config/db");

// @desc    Search for a user by email or phone
// @route   GET /api/users/search
// @access  Private
const searchUser = async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({
                success: false,
                message: "Please provide a search query (email or phone)",
            });
        }

        const result = await pool.query(
            `SELECT user_id, first_name, last_name, email, phone_number 
       FROM users 
       WHERE email = $1 OR phone_number = $1`,
            [query]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const user = result.rows[0];

        res.json({
            success: true,
            data: {
                user_id: user.user_id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                phone_number: user.phone_number,
            },
        });
    } catch (error) {
        console.error("Search user error:", error);
        res.status(500).json({
            success: false,
            message: "Error searching for user",
        });
    }
};

module.exports = {
    searchUser,
};
