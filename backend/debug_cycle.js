const pool = require('./config/db');
const { createCycle } = require('./controllers/roscaController');

async function testCreate() {
  const req = {
    user: { user_id: 1, role: 'CHAIRPERSON' },
    params: { chamaId: "1" },
    body: {
      chama_id: 1,
      cycle_name: 'Test Cycle 2026',
      contribution_amount: 1500,
      frequency: 'MONTHLY',
      start_date: new Date().toISOString().split('T')[0],
      roster_method: 'RANDOM'
    }
  };

  const res = {
    status: (code) => ({
      json: (data) => console.log(`STATUS: ${code}`, data)
    }),
    json: (data) => console.log('STATUS: 200/201', data)
  };

  try {
    await createCycle(req, res);
  } catch(e) {
    console.error('UNCAUGHT EXCEPTION:', e);
  }
  pool.end();
}

testCreate();
