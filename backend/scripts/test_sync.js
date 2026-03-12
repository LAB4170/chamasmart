const fetch = require('node-fetch');

async function testFirebaseSync() {
  try {
    const response = await fetch('http://localhost:5005/api/auth/firebase-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        idToken: 'fake_token_to_trigger_logs', // This won't work with Firebase Admin, but we can capture the error.
        phoneNumber: '+254796874205'
      })
    });
    
    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testFirebaseSync();
