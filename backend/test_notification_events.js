const axios = require('axios');
const jwt = require('jsonwebtoken');
const pool = require('./config/db');
require('dotenv').config();

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runNotificationTests() {
    try {
        console.log("--- Starting Notification Tests ---");
        
        // Setup: Find testing users
        const officialRes = await pool.query(`
            SELECT u.user_id, u.email, u.role, cm.chama_id
            FROM users u
            JOIN chama_members cm ON u.user_id = cm.user_id
            WHERE cm.role IN ('CHAIRPERSON', 'ADMIN')
            AND u.is_active = true
            LIMIT 1
        `);
        
        if (officialRes.rows.length === 0) {
            console.log("No official users found to test with.");
            return;
        }

        const officialUser = officialRes.rows[0];
        const chamaId = officialUser.chama_id;
        
        const testMemberRes = await pool.query(`
            SELECT u.user_id, u.email, u.role
            FROM users u
            JOIN chama_members cm ON u.user_id = cm.user_id
            WHERE cm.chama_id = $1 AND u.user_id != $2 AND u.is_active = true
            LIMIT 1
        `, [chamaId, officialUser.user_id]);

        const testMember = testMemberRes.rows.length > 0 ? testMemberRes.rows[0] : null;

        const officialToken = jwt.sign(
            { sub: officialUser.user_id, role: officialUser.role, email: officialUser.email }, 
            process.env.JWT_SECRET || 'your_super_secret_jwt_key_here', 
            { expiresIn: '1h' }
        );

        // 1. Test Meeting Notification
        console.log(`\n1. Testing Meeting Creation Notification...`);
        try {
            const meetingRes = await axios.post(`http://localhost:5005/api/meetings/chamas/${chamaId}`, 
                { 
                    title: "Test Notifications Meeting", 
                    description: "checking notifs", 
                    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
                    location: "Online",
                    type: "VIRTUAL"
                }, 
                { headers: { Authorization: `Bearer ${officialToken}` } }
            );
            console.log(`✅ Meeting created. Status: ${meetingRes.status}`);
            
            await delay(1000); // Wait a second for DB to write notifications
            
            if (testMember) {
                const notifCheck = await pool.query(
                    `SELECT * FROM notifications WHERE user_id = $1 AND type = 'MEETING_CREATED' ORDER BY created_at DESC LIMIT 1`,
                    [testMember.user_id]
                );
                if (notifCheck.rows.length > 0) {
                    console.log(`✅ Verified! Test Member ID ${testMember.user_id} received Meeting Notification: ${notifCheck.rows[0].title}`);
                } else {
                    console.log(`❌ Failed: No meeting notification found for Test Member ID ${testMember.user_id}`);
                }
            }
        } catch (err) {
            console.error(`❌ Meeting creation failed: ${err.message}`);
            if(err.response) console.error(err.response.data);
        }

        // 2. Test Role Update Notification
        if (testMember) {
             console.log(`\n2. Testing Role Update Notification...`);
             try {
                 const roleRes = await axios.put(`http://localhost:5005/api/members/${chamaId}/role/${testMember.user_id}`, 
                     { role: 'SECRETARY' }, // temporarily make them secretary
                     { headers: { Authorization: `Bearer ${officialToken}` } }
                 );
                 console.log(`✅ Role updated to SECRETARY. Status: ${roleRes.status}`);
                 
                 await delay(1000);
                 
                 const notifCheck = await pool.query(
                     `SELECT * FROM notifications WHERE user_id = $1 AND type = 'ROLE_UPDATED' ORDER BY created_at DESC LIMIT 1`,
                     [testMember.user_id]
                 );
                 if (notifCheck.rows.length > 0) {
                     console.log(`✅ Verified! Test Member ID ${testMember.user_id} received Role Notification: ${notifCheck.rows[0].title}`);
                 } else {
                     console.log(`❌ Failed: No role notification found`);
                 }

                 // Revert to member
                 await axios.put(`http://localhost:5005/api/members/${chamaId}/role/${testMember.user_id}`, 
                     { role: 'MEMBER' },
                     { headers: { Authorization: `Bearer ${officialToken}` } }
                 );
             } catch(err) {
                 console.error(`❌ Role test failed: ${err.message}`);
                 if(err.response) console.error(err.response.data);
             }
        }

        // 3. Test Join via Code Notification
        console.log(`\n3. Testing Member Joined Notification...`);
        try {
            const genRes = await axios.post(`http://localhost:5005/api/invites/${chamaId}/generate`, 
                { maxUses: 1, expiresInDays: 7 }, 
                { headers: { Authorization: `Bearer ${officialToken}` } }
            );
            const inviteCode = genRes.data.data.invite_code;
            
            // Get an external user to join
            const newJoinerRes = await pool.query(`
                SELECT user_id, email, role FROM users u
                WHERE u.is_active = true AND NOT EXISTS (
                    SELECT 1 FROM chama_members cm WHERE cm.user_id = u.user_id AND cm.chama_id = $1
                ) LIMIT 1
            `, [chamaId]);

            if (newJoinerRes.rows.length > 0) {
                 const newJoiner = newJoinerRes.rows[0];
                 const joinerToken = jwt.sign(
                     { sub: newJoiner.user_id, role: newJoiner.role, email: newJoiner.email }, 
                     process.env.JWT_SECRET || 'your_super_secret_jwt_key_here', 
                     { expiresIn: '1h' }
                 );

                 const joinRes = await axios.post(`http://localhost:5005/api/invites/join`, 
                     { inviteCode: inviteCode }, 
                     { headers: { Authorization: `Bearer ${joinerToken}` } }
                 );
                 console.log(`✅ New user joined. Status: ${joinRes.status}`);

                 await delay(1000);

                 // Check if the OFFICIAL user got notified
                 const notifCheck = await pool.query(
                     `SELECT * FROM notifications WHERE user_id = $1 AND type = 'MEMBER_JOINED' ORDER BY created_at DESC LIMIT 1`,
                     [officialUser.user_id]
                 );
                 // Check if the NEW user got their welcome
                 const welcomeCheck = await pool.query(
                     `SELECT * FROM notifications WHERE user_id = $1 AND type = 'MEMBER_ADDED' ORDER BY created_at DESC LIMIT 1`,
                     [newJoiner.user_id]
                 );

                 if (notifCheck.rows.length > 0) {
                     console.log(`✅ Verified! Official received Member Joined Notification.`);
                 } else {
                     console.log(`❌ Failed: No joined notification found for official.`);
                 }

                 if (welcomeCheck.rows.length > 0) {
                     console.log(`✅ Verified! New user received Welcome Notification.`);
                 } else {
                     console.log(`❌ Failed: No welcome notification found for new user.`);
                 }

            } else {
                console.log("No external active users available to test join.");
            }
        } catch(err) {
            console.error(`❌ Member Join test failed: ${err.message}`);
            if(err.response) console.error(err.response.data);
        }

    } catch (err) {
        console.error("Master Test Script Error:", err.message);
    } finally {
        pool.end();
        console.log("\n--- Testing Complete ---");
    }
}

runNotificationTests();
