const axios = require('axios');
require('dotenv').config();

async function testStats() {
  try {
    // 1. Login to get token
    const loginRes = await axios.post('http://localhost:5005/api/users/login', {
      email: 'mickey88855@gmail.com', // Using standard test user
      password: 'password123'
    });
    
    const token = loginRes.data.token;
    
    console.log("Testing getChamaStats for Chama ID 19...");
    // 2. Fetch stats using the token
    const statsRes = await axios.get('http://localhost:5005/api/chamas/19/stats', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log(statsRes.data);
    
    console.log("\nTesting getChamaMembers for Chama ID 19...");
    // 3. Fetch members using the token
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
