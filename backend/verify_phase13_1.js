const axios = require('axios');
require('dotenv').config();

const API_URL = 'http://localhost:5005/api';
// Using a test chama ID from previous verifications if available, otherwise 1
const CHAMA_ID = 1; // Testing with chama 1
const TOKEN = process.argv[2]; 

async function test13_1() {
  console.log('--- Testing Phase 13.1 Backend Endpoints ---');
  
  const config = {
    headers: { Authorization: `Bearer ${TOKEN}` }
  };

  try {
    // 1. Test Member Standing
    console.log('\n1. Testing Member Standing...');
    const standingRes = await axios.get(`${API_URL}/asca/${CHAMA_ID}/reports/standing`, config);
    console.log('✅ Member Standing:', JSON.stringify(standingRes.data.data, null, 2));

    // 2. Test Chama Loan Analytics
    console.log('\n2. Testing Chama Loan Analytics...');
    const analyticsRes = await axios.get(`${API_URL}/loans/${CHAMA_ID}/reports/analytics`, config);
    console.log('✅ Chama Analytics:', JSON.stringify(analyticsRes.data.data, null, 2));

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    if (err.response) {
      console.log('Status:', err.response.status);
      console.log('Error details:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.log('No response from server.');
    }
  }
}

// Note: This requires the server to be running.
// If not running, I'll use direct controller testing if needed.
test13_1();
