require('dotenv').config();
const mpesaService = require('./utils/mpesaService');

async function testMock() {
    console.log('--- Testing M-Pesa Mock Mode ---');
    console.log('MPESA_MOCK:', process.env.MPESA_MOCK);
    
    try {
        console.log('\n1. Testing Access Token...');
        const token = await mpesaService.getAccessToken();
        console.log('Success! Token:', token);

        console.log('\n2. Testing STK Push...');
        const push = await mpesaService.initiateStkPush('254712345678', 1, 'TestRef', 'TestDesc');
        console.log('Success! Response:', JSON.stringify(push, null, 2));

        console.log('\n3. Testing Query Status...');
        const status = await mpesaService.queryStatus(push.CheckoutRequestID);
        console.log('Success! Status:', JSON.stringify(status, null, 2));

        console.log('\n--- VERIFICATION PASSED: Mock Mode Active ---');
        process.exit(0);
    } catch (error) {
        console.error('\n--- VERIFICATION FAILED ---');
        console.error('Error:', error.message);
        process.exit(1);
    }
}

testMock();
