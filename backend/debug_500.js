const { getMyChamas } = require('./controllers/chamaController');
const { getUnifiedLoanSummary } = require('./controllers/loanController');
const db = require('./config/db');

const req = {
  query: { page: 1, limit: 20 },
  user: { user_id: 2 } // assuming user_id 2 based on previous log
};

const res = {
  status: (code) => {
    console.log('Status set to:', code);
    return res;
  },
  json: (data) => console.log('JSON called:', JSON.stringify(data, null, 2)),
  error: (msg, code) => console.log('Error called:', msg, code),
  paginated: (data, page, limit, total, msg) => console.log('Paginated called with:', { page, limit, total, msg })
};

async function test() {
  try {
    console.log('--- Testing getMyChamas ---');
    await getMyChamas(req, res);
  } catch (err) {
    console.error('Exception in getMyChamas:', err);
  }
  
  try {
    console.log('--- Testing getUnifiedLoanSummary ---');
    await getUnifiedLoanSummary(req, res);
  } catch (err) {
    console.error('Exception in getUnifiedLoanSummary:', err);
  }
  
  process.exit(0);
}

test();
