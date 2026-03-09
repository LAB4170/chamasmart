require('dotenv').config();
const mpesaService = require('./utils/mpesaService');

async function testAuth() {
  console.log('Environment:', process.env.MPESA_ENV);
  console.log('Base URL:', mpesaService.baseUrl);
  console.log('Consumer Key length:', process.env.MPESA_CONSUMER_KEY?.length);
  
  try {
    const token = await mpesaService.getAccessToken();
    console.log('Access Token generated successfully!');
    console.log('Token (first 10 chars):', token.substring(0, 10));
    process.exit(0);
  } catch (error) {
    console.error('M-Pesa Auth Test Failed');
    console.error('Error message:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data));
    } else {
      console.error('No response received (Network Error or Timeout)');
    }
    process.exit(1);
  }
}

testAuth();
