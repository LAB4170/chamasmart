const https = require('https');
const dns = require('dns');

console.log('--- Network Diagnostic Starting ---');

dns.lookup('sandbox.safaricom.co.ke', (err, address, family) => {
    if (err) {
        console.error('DNS Lookup Failed:', err.message);
    } else {
        console.log('DNS Lookup Success:', address);
    }

    const options = {
        hostname: 'sandbox.safaricom.co.ke',
        port: 443,
        path: '/oauth/v1/generate?grant_type=client_credentials',
        method: 'GET',
        timeout: 5000
    };

    console.log('Attempting HTTPS request to Safaricom Sandbox...');
    const req = https.request(options, (res) => {
        console.log('Response Status:', res.statusCode);
        res.on('data', (d) => {
            process.stdout.write(d);
        });
    });

    req.on('timeout', () => {
        console.error('Request Timed Out (5000ms)');
        req.destroy();
    });

    req.on('error', (e) => {
        console.error('Request Error:', e.message);
    });

    req.end();
});
