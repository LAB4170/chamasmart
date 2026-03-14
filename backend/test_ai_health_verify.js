const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const fs = require('fs');

const CHAMA_ID = 19;
const USER_ID = 2; 
const secret = process.env.JWT_SECRET || 'your_jwt_secret';
const token = jwt.sign({ id: USER_ID, sub: USER_ID, role: 'member' }, secret, { expiresIn: '1h' });

const baseUrl = 'http://localhost:5005/api';

async function verifyAIHealth() {
  console.log('--- AI Health Alert Optimization Verification Started ---');

  try {
    // 1. Clear cache to force generation
    // (Note: In a real test environment we might need a direct DB call or just wait 24h, 
    // but here we can just check if the returned engine is not 'cached')
    
    // 2. Fetch Alerts
    const res = await axios.get(`${baseUrl}/chamas/${CHAMA_ID}/health-alerts`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✅ Health Alerts Fetch: SUCCESS');
    const { engine, alertCount, alerts } = res.data.data;
    console.log(`   Engine Used: ${engine}`);
    console.log(`   Alerts Count: ${alertCount}`);

    // 3. Verify Alert Structure and Quality
    if (alertCount === 3) {
        console.log('✅ Count Check: SUCCESS (Exactly 3 alerts returned)');
    } else {
        console.warn(`⚠️ Count Check: RECEIVED ${alertCount} alerts (Expected 3)`);
    }

    const firstAlert = alerts[0];
    const requiredFields = ['id', 'severity', 'icon', 'title', 'detail', 'action'];
    const missingFields = requiredFields.filter(f => !firstAlert[f]);

    if (missingFields.length === 0) {
        console.log('✅ Alert Schema: SUCCESS (All fields present)');
    } else {
        console.error('❌ Alert Schema: FAILED. Missing fields:', missingFields);
    }

    // 4. Examine content (look for keywords indicating rich context)
    const combinedText = JSON.stringify(alerts).toLowerCase();
    const richKeywords = ['liquidity', 'ratio', 'interest', 'capital', 'utilization', 'savings', 'growth'];
    const foundKeywords = richKeywords.filter(k => combinedText.includes(k));

    console.log(`   Context Keywords Found: ${foundKeywords.join(', ')}`);
    if (foundKeywords.length >= 2) {
        console.log('✅ Context Check: SUCCESS (Alerts reflect rich financial metrics)');
    } else {
        console.warn('⚠️ Context Check: Alerts seem generic. AI might not be fully utilizing context or using fallback.');
    }

  } catch (err) {
    console.error('❌ Verification Error:', err.response?.data?.message || err.message);
  }

  console.log('--- AI Health Alert Optimization Verification Completed ---');
}

verifyAIHealth();
