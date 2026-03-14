const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Forge a valid token for user ID 2 (which is Eobord/Creator of Chama 19)
const secret = process.env.JWT_SECRET || 'your_jwt_secret';
const token = jwt.sign({ id: 2, sub: 2 }, secret, { expiresIn: '1h' });

async function testStats() {
  try {
    console.log("Testing getChamaStats for Chama ID 19...");
    // Fetch stats using the token
    const statsRes = await axios.get('http://localhost:5005/api/chamas/19/stats', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(statsRes.data);
    
    console.log("\nTesting getChamaMembers for Chama ID 19...");
    // Fetch members using the token
    const membersRes = await axios.get('http://localhost:5005/api/chamas/19/members', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(`Members count: ${membersRes.data.count}`);
    
  } catch (error) {
    if (error.response) {
      console.error(`Error ${error.response.status}:`, error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testStats();
