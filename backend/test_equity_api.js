// test_equity_api.js
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function main() {
  const chamaId = 19;
  const userId = 2; // Member of Chama 19
  
  // Generate a temporary token if needed, or use a known one.
  // We need a valid token to pass 'protect' middleware.
  const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET || 'secret');
  
  try {
    const res = await axios.get(`http://localhost:5005/api/asca/${chamaId}/equity`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('SUCCESS:', res.data);
  } catch (err) {
    if (err.response) {
      console.log('ERROR STATUS:', err.response.status);
      console.log('ERROR DATA:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('FAILED TO CONNECT:', err.message);
    }
  }
}

main();
