const axios = require('axios');

async function testFirebaseSync() {
  try {
    console.log("Testing POST /api/auth/firebase-sync...");
    const response = await axios.post('http://localhost:5005/api/auth/firebase-sync', {
      idToken: "test-token-123", // Even an invalid token should fail gracefully with a 401, not a 500 crash
      firstName: "Test",
      lastName: "User"
    });
    console.log("Success:", response.data);
  } catch (error) {
    if (error.response) {
      console.error("\nAPI Error Response:");
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("\nConnection Error:", error.message);
    }
  }
}

testFirebaseSync();
