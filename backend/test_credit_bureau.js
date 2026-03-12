const axios = require('axios');
const pool = require('./config/db');

const BASE_URL = 'http://localhost:5005/api';

async function verifyCreditBureau() {
    try {
        console.log('--- Phase 24 Verification: Chama Credit Bureau & AI Health Coach ---\n');

        console.log('1. Generating direct JWT token for User 1 (Alice)...');
        const jwt = require('jsonwebtoken');
        require('dotenv').config();
        
        // auth.js expects decoded.sub to be the user_id. We'll use 'sub: 1'.
        const token = jwt.sign({ sub: 1 }, process.env.JWT_SECRET, { expiresIn: '1d' });
        const config = { headers: { Authorization: `Bearer ${token}` } };
        console.log('âœ“ Token generated successfully.\n');

        console.log('2. Fetching a chama ID from the database...');
        const { rows } = await pool.query('SELECT chama_id, chama_name FROM chamas LIMIT 1');
        if (rows.length === 0) {
            console.log('âœ˜ No chamas found in DB.');
            process.exit(1);
        }
        const chamaId = rows[0].chama_id;
        console.log(`âœ“ Selected Chama ID: ${chamaId} (${rows[0].chama_name})\n`);

        console.log('3. Testing GET /api/chamas/:id/score (Compute & Cache Score)...');
        const scoreRes = await axios.get(`${BASE_URL}/chamas/${chamaId}/score`, config);
        console.log('Score Response Data:');
        console.log(JSON.stringify(scoreRes.data.data, null, 2));
        console.log('âœ“ Score API successful.\n');

        console.log('4. Testing GET /api/chamas/:id/score/history (Score History)...');
        const historyRes = await axios.get(`${BASE_URL}/chamas/${chamaId}/score/history`, config);
        console.log(`History count: ${historyRes.data.data.length}`);
        console.log('âœ“ History API successful.\n');

        console.log('5. Testing GET /api/chamas/:id/health-alerts (AI Health Coach)...');
        const alertsRes = await axios.get(`${BASE_URL}/chamas/${chamaId}/health-alerts`, config);
        console.log('Health Alerts:');
        console.log(JSON.stringify(alertsRes.data.data, null, 2));
        console.log('âœ“ Alerts API successful.\n');

        console.log('--- Verification Complete! ---');

    } catch (error) {
        console.error('Verification failed:');
        if (error.response) {
            console.error(error.response.status, error.response.data);
        } else {
            console.error(error.message);
        }
    } finally {
        await pool.end();
    }
}

verifyCreditBureau();
