require('dotenv').config();
const jwt = require('jsonwebtoken');
const http = require('http');

// Generate mock token for user 3 (assuming official)
const token = jwt.sign({ sub: 3 }, process.env.JWT_SECRET || 'fallback-secret');

const options = {
  hostname: 'localhost',
  port: 5005,
  path: '/api/loans/19/41/approve', // use the user's crashing endpoints
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json' // maybe missing content type was breaking it?
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`BODY: ${data}`);
  });
});

req.on('error', e => {
  console.error(`Problem with request: ${e.message}`);
});

// Empty body, exactly like the frontend
req.end();
