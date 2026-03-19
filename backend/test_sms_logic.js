const { SMSOTP } = require('./utils/otp');
require('dotenv').config();

async function testSMS() {
  console.log('Testing SMSOTP class...');
  
  const twilioSms = new SMSOTP('twilio');
  const atSms = new SMSOTP('africas_talking');
  
  console.log('Twilio Provider:', twilioSms.provider);
  console.log('Africa\'s Talking Provider:', atSms.provider);
  
  // Test formatting
  const phone = '0712345678';
  const formatted = twilioSms.formatPhoneNumber(phone, '+254');
  console.log(`Original: ${phone}, Formatted: ${formatted}`);
  
  if (formatted !== '+254712345678') {
    console.error('❌ Phone formatting failed!');
  } else {
    console.log('✅ Phone formatting passed.');
  }
  
  // Attempt to send (should fail if no credentials, but should not crash)
  console.log('Attempting to send via Twilio (expecting failure if no creds)...');
  const result = await twilioSms.send(phone, '123456');
  console.log('Result:', result);
  
  console.log('Test completed.');
}

testSMS().catch(console.error);
