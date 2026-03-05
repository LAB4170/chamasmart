const loanController = require('./controllers/loanController');
const ascaController = require('./controllers/ascaController');
const pool = require('./config/db');

async function testDirect() {
    console.log('--- Direct Controller Testing ---');
    const chamaId = 1;
    const userId = 1;

    const mockRes = {
        status: function(code) { 
            this.statusCode = code; 
            return this; 
        },
        json: function(data) {
            console.log('Response:', JSON.stringify(data, null, 2));
        }
    };

    console.log('\nTesting getMemberStanding...');
    try {
        await ascaController.getMemberStanding({ params: { chamaId }, user: { user_id: userId } }, mockRes);
    } catch (err) {
        console.error('Error in getMemberStanding:', err);
    }

    console.log('\nTesting getChamaLoanAnalytics...');
    try {
        await loanController.getChamaLoanAnalytics({ params: { chamaId }, user: { user_id: userId } }, mockRes);
    } catch (err) {
        console.error('Error in getChamaLoanAnalytics:', err);
    }

    await pool.end();
}

testDirect();
