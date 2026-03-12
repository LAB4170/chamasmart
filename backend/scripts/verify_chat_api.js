const axios = require('axios');
const jwt = require('jsonwebtoken');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'chamasmart',
  password: process.env.DB_PASSWORD || '1234',
  port: process.env.DB_PORT || 5432,
});

async function runTest() {
  const client = await pool.connect();
  try {
    // Dynamically fetch a real user and chama to ensure foreign keys and auth succeed
    const userRes = await client.query("SELECT user_id, email FROM users LIMIT 1");
    if (userRes.rows.length === 0) throw new Error("No users found in database to simulate test from.");
    const testUser = userRes.rows[0];

    const chamaRes = await client.query("SELECT chama_id FROM chamas LIMIT 1");
    if (chamaRes.rows.length === 0) throw new Error("No chamas found in database to test messaging against.");
    const testChama = chamaRes.rows[0];

    const token = jwt.sign(
      { sub: testUser.user_id, email: testUser.email }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1h' }
    );
    
    const headers = { Authorization: `Bearer ${token}` };

    console.log(`1. Fetching/Creating Default Channel for Chama ${testChama.chama_id} as User ${testUser.user_id}...`);
    const channelsRes = await axios.get(`http://localhost:5005/api/chat/chamas/${testChama.chama_id}/channels`, { headers });
    const channelId = channelsRes.data.data[0].channel_id;
    console.log(`✅ Channel retrieved: ID ${channelId}`);

    console.log("2. Sending a test text message...");
    const msgRes = await axios.post(`http://localhost:5005/api/chat/channels/${channelId}/messages`, {
      messageType: 'text',
      content: 'Hello! This is an automated test verifying the Phase 30 Chat Infrastructure.'
    }, { headers });
    
    console.log('✅ Message successfully broadcasted:', msgRes.data.data.content);
    console.log('\n✅ Phase 30.1 Backend Infrastructure execution verified PASSED.');
  } catch (error) {
    console.error('❌ Verification failed:', error.response?.data || error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Give the server a few seconds to fully boot up before testing
setTimeout(runTest, 1000);
