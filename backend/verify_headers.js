const http = require('http');

async function verifyHeaders() {
    console.log('--- Verifying Security Headers ---');
    
    http.get('http://localhost:5005/api/ping', (res) => {
        const coop = res.headers['cross-origin-opener-policy'];
        console.log('Cross-Origin-Opener-Policy:', coop);
        
        if (coop === 'unsafe-none') {
            console.log('✓ Verification Passed: COOP is relaxed for development.');
        } else {
            console.error('✗ Verification Failed: COOP is still strict:', coop);
        }
        process.exit(coop === 'unsafe-none' ? 0 : 1);
    }).on('error', (e) => {
        console.error('Failed to connect to server:', e.message);
        process.exit(1);
    });
}

verifyHeaders();
