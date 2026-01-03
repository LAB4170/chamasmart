const https = require('http');

console.log("Sending request without Content-Type...");

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/auth/register',
  method: 'POST',
  // No headers
};

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => console.log('BODY:', body));
});

req.on('error', (e) => console.error(`problem with request: ${e.message}`));
req.end();
