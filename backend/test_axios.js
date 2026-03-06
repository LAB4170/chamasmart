require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const pool = require('./config/db');

async function run() {
  try {
    const res = await pool.query("SELECT user_id FROM chama_members WHERE chama_id=19 AND role IN ('CHAIRPERSON', 'TREASURER', 'ADMIN') AND is_active=true LIMIT 1");
    if(res.rows.length === 0) { console.log('No official found'); return; }
    const uid = res.rows[0].user_id;

    // mock token
    const token = jwt.sign({ sub: uid }, process.env.JWT_SECRET);
    
    console.log('Sending request to approve loan 26 as user ' + uid + '...');
    
    // send put request with no body, just like frontend
    const response = await axios.put('http://localhost:5005/api/loans/19/26/approve', {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('SUCCESS API RESPONSE:', response.data);
  } catch (err) {
    if (err.response) {
      console.error(`FAILED STATUS: ${err.response.status}`);
      console.error(`FAILED DATA:`, err.response.data);
      // if it's returning HTML we'll see it here!
    } else {
      console.error('Request failed entirely:', err.message);
    }
  } finally {
    pool.end();
  }
}

run();
