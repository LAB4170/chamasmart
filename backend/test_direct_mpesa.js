const axios = require('axios');
require('dotenv').config();

async function test() {
    const key = process.env.MPESA_CONSUMER_KEY;
    const secret = process.env.MPESA_CONSUMER_SECRET;
    const auth = Buffer.from(`${key}:${secret}`).toString('base64');
    const url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
    
    console.log('Testing direct axios call to:', url);
    try {
        const res = await axios.get(url, {
            headers: { Authorization: `Basic ${auth}` },
            timeout: 5000
        });
        console.log('Success!', res.status);
    } catch (err) {
        console.error('Failed!');
        console.error('Message:', err.message);
        if (err.code) console.error('Code:', err.code);
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', err.response.data);
        }
    }
}

test();
