const axios = require('axios');
const jwt = require('jsonwebtoken');
const pool = require('./config/db');
require('dotenv').config();

async function runTests() {
    try {
        const userRes = await pool.query('SELECT user_id, email, role FROM users LIMIT 1');
        if(userRes.rows.length === 0) {
           console.log("No users found to test with.");
           return;
        }
        const user = userRes.rows[0];
        const token = jwt.sign(
            { user_id: user.user_id, role: user.role, email: user.email }, 
            process.env.JWT_SECRET || 'your_super_secret_jwt_key_here', 
            { expiresIn: '1h' }
        );

        console.log(`Testing GET /api/meetings/1 for user: ${user.email}`);
        
        // Use a dummy chamaId 1, if it fails with 404 or 403 that is fine. 500 is what we want to avoid.
        const getRes = await axios.get('http://localhost:5005/api/meetings/1', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`GET Response Status: ${getRes.status}`);
        console.log(`GET Response Data:`, getRes.data);
    } catch (err) {
        // If it throws 403 or 404, it means the API logic is working and catching our fake IDs, rather than crashing on DB queries
        if (err.response && (err.response.status === 403 || err.response.status === 404)) {
            console.log(`Server responded gracefully with: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
            console.log("SUCCESS: The 500 error is resolved.");
        } else {
            console.error('GET Error:', err.response ? `${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message);
        }
    } finally {
        pool.end();
    }
}

runTests();
