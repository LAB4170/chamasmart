const axios = require('axios');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

async function runLLMTest() {
    const testPool = new Pool({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'chamasmart',
        password: process.env.DB_PASSWORD || '1234',
        port: process.env.DB_PORT || 5432,
    });

    try {
        console.log('--- 1. Fetching valid user/chama for test ---');
        const { rows } = await testPool.query(`
            SELECT cm.chama_id, cm.user_id, u.phone_number as phone
            FROM chama_members cm
            JOIN users u ON cm.user_id = u.user_id
            WHERE cm.is_active = true 
            LIMIT 1
        `);

        if (rows.length === 0) {
            console.error('No active chama members found in DB to test with.');
            return;
        }

        const { chama_id: targetChamaId, user_id: userId, phone } = rows[0];
        console.log(`Testing Groq Coach against Chama ID: ${targetChamaId} as User ID: ${userId}`);

        // Create valid JWT
        const payload = { sub: userId, phone, role: 'MEMBER' };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });

        const baseUrl = `http://localhost:${process.env.PORT || 5005}/api/chamas`;

        console.log('--- 2. Requesting AI Health Alerts (Groq) ---');
        const response = await axios.get(`${baseUrl}/${targetChamaId}/health-alerts`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Response Status:', response.status);
        if (response.data.success) {
            console.log('SUCCESS! engine used:', response.data.data.engine);
            console.log('Alert Count:', response.data.data.alertCount);
            console.log('First Alert:', JSON.stringify(response.data.data.alerts[0], null, 2));

            console.log('--- 3. Verifying Cache ---');
            const cacheResponse = await axios.get(`${baseUrl}/${targetChamaId}/health-alerts`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('Cache Hit:', cacheResponse.data.data.isCached ? 'YES' : 'NO');
            if (cacheResponse.data.data.isCached) {
                console.log('VERIFICATION COMPLETE: Groq + Caching working.');
            } else {
                console.error('FAIL: Cache not hit on second request.');
            }
        } else {
            console.error('API returned success: false', response.data);
        }

    } catch (err) {
        console.error('Test Failed!', err.response ? err.response.data : err.message);
    } finally {
        await testPool.end();
    }
}

runLLMTest();
