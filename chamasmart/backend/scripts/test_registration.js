const http = require('http');

const data = JSON.stringify({
    email: 'test_user_' + Date.now() + '@example.com',
    password: 'Password123!@#',
    firstName: 'Test',
    lastName: 'User',
    phoneNumber: '0712345678'
});

const options = {
    hostname: 'localhost',
    port: 5005,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log('Status:', res.statusCode);
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (e) => {
    console.error('Error:', e.message);
});

req.write(data);
req.end();
