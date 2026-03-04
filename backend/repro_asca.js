const axios = require('axios');

async function repro() {
  const API_URL = 'http://localhost:5005/api';
  
  try {
    // 1. Login to get token
    console.log('Logging in...');
    const loginRes = await axios.post(`${API_URL}/auth/firebase/sync`, {
      uid: 'user123', // Dummy for testing if possible, but I need a real token
    }, {
        headers: {
            'Authorization': 'Bearer YOUR_TOKEN_HERE' // I'll need to grab a token from the terminal or env if possible
        }
    });
    
    // Actually, I'll just try to create a chama with a dummy token to see if it triggers 401 vs 403 vs 400
    console.log('Trying to create ASCA chama...');
    const res = await axios.post(`${API_URL}/chamas`, {
      chamaName: "Test ASCA",
      chamaType: "ASCA",
      description: "Test",
      contributionAmount: 1000,
      contributionFrequency: "MONTHLY",
      meetingDay: "Monday",
      meetingTime: "10:00",
      visibility: "PRIVATE"
    }, {
      headers: {
        'Authorization': 'Bearer INVALID_TOKEN'
      }
    });
    console.log('Response:', res.status, res.data);
  } catch (err) {
    console.log('Error Status:', err.response?.status);
    console.log('Error Data:', err.response?.data);
  }
}

repro();
