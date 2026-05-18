const http = require('http');

const req = http.request({
    hostname: 'localhost',
    port: 5006,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const body = JSON.parse(data);
        if (!body.data || !body.data.tokens) {
            console.log("Registration failed:", data);
            return;
        }
        const token = body.data.tokens.accessToken;
        console.log("Token received.");
        
        const req2 = http.request({
            hostname: 'localhost',
            port: 5006,
            path: '/api/v1/loans/unified-summary',
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + token }
        }, (res2) => {
            console.log("Status:", res2.statusCode);
            let data2 = '';
            res2.on('data', chunk => data2 += chunk);
            res2.on('end', () => console.log("Response:", data2));
        });
        req2.end();
    });
});

req.write(JSON.stringify({
    firstName: 'Test', lastName: 'User', email: 'test_' + Date.now() + '@example.com',
    phoneNumber: '+254700' + Math.floor(Math.random() * 9999), password: 'password123'
}));
req.end();
