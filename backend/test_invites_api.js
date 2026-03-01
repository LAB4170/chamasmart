const axios = require('axios');
const jwt = require('jsonwebtoken');
const pool = require('./config/db');
require('dotenv').config();

async function runInviteTests() {
    try {
        console.log("--- Starting Invite Tests ---");
        
        // 1. Get an official user to generate invites (e.g., ADMIN or CHAIRPERSON)
        const officialRes = await pool.query(`
            SELECT u.user_id, u.email, u.role, cm.chama_id
            FROM users u
            JOIN chama_members cm ON u.user_id = cm.user_id
            WHERE cm.role IN ('CHAIRPERSON', 'ADMIN', 'TREASURER', 'SECRETARY')
            AND u.is_active = true
            LIMIT 1
        `);
        
        if (officialRes.rows.length === 0) {
            console.log("No official users found with a chama to test with.");
            return;
        }
        const officialUser = officialRes.rows[0];
        const chamaId = officialUser.chama_id;
        
        const officialToken = jwt.sign(
            { sub: officialUser.user_id, role: officialUser.role, email: officialUser.email }, 
            process.env.JWT_SECRET || 'your_super_secret_jwt_key_here', 
            { expiresIn: '1h' }
        );

        // 2. Test Sending Email Invite (This failed with 400 before)
        console.log(`\n1. Testing Email Invite (POST /api/invites/${chamaId}/send)...`);
        try {
            const sendRes = await axios.post(`http://localhost:5005/api/invites/${chamaId}/send`, 
                { email: "testverify@example.com", role: "MEMBER" }, 
                { headers: { Authorization: `Bearer ${officialToken}` } }
            );
            console.log(`✅ SUCCESS - Email Invite Sent. Status: ${sendRes.status}`);
        } catch (err) {
            console.error(`❌ FAILED - Email Invite. Target fix failed.`);
            console.error(err.response ? `${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message);
        }

        // 3. Test Generating a Code and Joining
        console.log(`\n2. Testing Generate & Join with Code...`);
        let inviteCode = "";
        try {
            const genRes = await axios.post(`http://localhost:5005/api/invites/${chamaId}/generate`, 
                { maxUses: 1, expiresInDays: 7 }, 
                { headers: { Authorization: `Bearer ${officialToken}` } }
            );
            inviteCode = genRes.data.data.invite_code;
            console.log(`✅ SUCCESS - Generated Invite Code: ${inviteCode}`);
        } catch (err) {
            console.error("❌ FAILED to generate code.");
            console.error(err.response ? `${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message);
        }

        // Get a DIFFERENT user to join using the code
        const joinerRes = await pool.query(`
            SELECT user_id, email, role FROM users 
            WHERE user_id != $1
            LIMIT 1
        `, [officialUser.user_id]);
        
        if (joinerRes.rows.length > 0 && inviteCode) {
            const joinerUser = joinerRes.rows[0];
            const joinerToken = jwt.sign(
                { sub: joinerUser.user_id, role: joinerUser.role, email: joinerUser.email }, 
                process.env.JWT_SECRET || 'your_super_secret_jwt_key_here', 
                { expiresIn: '1h' }
            );

            console.log(`\n3. Testing Join Chama (POST /api/invites/join) with code ${inviteCode}...`);
            try {
                const joinRes = await axios.post(`http://localhost:5005/api/invites/join`, 
                    { inviteCode: inviteCode }, 
                    { headers: { Authorization: `Bearer ${joinerToken}` } }
                );
                console.log(`✅ SUCCESS - Joined Chama using Code. Status: ${joinRes.status}`);
            } catch (err) {
                // It might fail gracefully if the user is already in the chama
                if (err.response && err.response.data.message.includes('already a member')) {
                   console.log(`✅ SUCCESS Logic - User tried joining but was rejected correctly: ${err.response.data.message}`);
                } else {
                   console.error("❌ FAILED to join with code.");
                   console.error(err.response ? `${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message);
                }
            }
        }
        
    } catch (err) {
        console.error("Master Test Script Error:", err.message);
    } finally {
        pool.end();
        console.log("\n--- Testing Complete ---");
    }
}

runInviteTests();
