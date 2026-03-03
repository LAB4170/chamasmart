const { 
  recordContribution, 
  submitContribution, 
  verifyContribution 
} = require('./controllers/contributionController');
const pool = require('./config/db');

async function testIsolated() {
  const req = {
    params: { chamaId: 1, id: 1 },
    body: {
      userId: 1,
      amount: 1000,
      paymentMethod: 'MPESA',
      receiptNumber: 'TEST1234',
      paymentProof: 'http://test.com/proof.jpg',
      notes: 'Test contribution'
    },
    user: { user_id: 1, role: 'TREASURER' },
    headers: {}
  };

  const res = {
    status: (code) => {
      console.log('Status Code:', code);
      return res;
    },
    json: (body) => {
      console.log('Response Body:', JSON.stringify(body, null, 2));
      return res;
    }
  };

  const next = (err) => {
    if (err) console.error('Next Error:', err);
  };

  console.log('--- Testing recordContribution ---');
  // recordContribution is an array [validation, handler]
  // We'll call the handler directly for now to bypass express-validator in this script
  const handler = recordContribution[recordContribution.length - 1];
  try {
    await handler(req, res, next);
  } catch (e) {
    console.error('Catch Error:', e);
  }

  process.exit(0);
}

testIsolated();
