const pool = require('./config/db');
const { Resend } = require('resend');
const Groq = require('groq-sdk');
const logger = require('./utils/logger');

// Mock req and res
const req = { params: { chamaId: '19' } };
const res = { 
  json: (data) => console.log('JSON Success:', data), 
  status: (code) => { console.log('HTTP Status:', code); return res; }
};
const next = (err) => console.error('Next Error:', err);

const { getHealthAlerts } = require('./controllers/financialHealthController');

async function testController() {
  console.log('Testing getHealthAlerts for chama 19...');
  try {
    await getHealthAlerts(req, res, next);
  } catch (e) {
    console.error('Caught Internal Exception:', e);
  }
}

testController().then(() => {
  console.log('Test logic finished.');
  process.exit(0);
}).catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
