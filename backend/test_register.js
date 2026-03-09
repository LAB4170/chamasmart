const http = require('http');

const data = JSON.stringify({
  firstName: 'Test',
  lastName: 'User',
  email: 'testuser_FINAL' + Date.now() + '@example.com',
  password: 'Password!' + Date.now() + 'Qwerty',
  phoneNumber: '2547' + Math.floor(10000000 + Math.random() * 90000000)
});

const options = {
  hostname: 'localhost',
  port: 5005,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  },
  timeout: 10000
};

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => {
    console.log('Response:', body);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
  process.exit(1);
});

req.on('timeout', () => {
    console.error('Request timed out!');
    req.destroy();
    process.exit(1);
});

req.write(data);
req.end();
