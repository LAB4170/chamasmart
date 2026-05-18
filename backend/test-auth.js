const axios = require('axios');

async function testAuth() {
    try {
        console.log("Registering a fresh user...");
        const regRes = await axios.post("http://localhost:5006/api/v1/auth/register", {
            firstName: "Test",
            lastName: "User",
            email: "test_script_" + Date.now() + "@example.com",
            phoneNumber: "+2547" + Math.floor(Math.random() * 10000000),
            password: "Password123!"
        });
        
        const token = regRes.data.data.tokens.accessToken;
        console.log("Got Token:", token.substring(0, 20) + "...");

        console.log("Testing authenticated request...");
        const summaryRes = await axios.get("http://localhost:5006/api/v1/loans/unified-summary", {
            headers: { Authorization: "Bearer " + token }
        });
        console.log("Summary Success:", summaryRes.data.message);

        const chamasRes = await axios.get("http://localhost:5006/api/v1/chamas/user/my-chamas", {
            headers: { Authorization: "Bearer " + token }
        });
        console.log("Chamas Success:", chamasRes.data.message);
        
    } catch (err) {
        if (err.response) {
            console.error("HTTP Error:", err.response.status, err.response.data);
        } else {
            console.error("Error:", err.message);
        }
    }
}

testAuth();
