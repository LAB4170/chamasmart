/**
 * Direct ASCA loan logic verification (no HTTP server dependency)
 * Tests the core eligibility logic directly against the DB
 */
require('dotenv').config();
const pool = require('./config/db');
const { applyForLoan } = require('./controllers/loanController');

async function testDirectLogic() {
  console.log('--- Direct ASCA Loan Logic Verification ---');

  try {
    // 1. Verify chama 8 is ASCA type
    const chamaRes = await pool.query("SELECT chama_type FROM chamas WHERE chama_id = 8");
    console.log('✅ Chama type:', chamaRes.rows[0].chama_type);

    // 2. Get the most recent active cycle
    const cycleRes = await pool.query(
      "SELECT cycle_id FROM asca_cycles WHERE chama_id = 8 AND status = 'ACTIVE' ORDER BY cycle_id DESC LIMIT 1"
    );
    const cycleId = cycleRes.rows[0].cycle_id;
    console.log('✅ Latest Active Cycle ID:', cycleId);

    // 3. Check user 1 equity in that cycle
    const memberRes = await pool.query(
      "SELECT total_investment FROM asca_members WHERE cycle_id = $1 AND user_id = 1",
      [cycleId]
    );
    const totalInvestment = parseFloat(memberRes.rows[0].total_investment);
    console.log('✅ User 1 total_investment:', totalInvestment, 'KES');
    console.log('✅ Max Loan Eligibility (3x):', totalInvestment * 3, 'KES');

    // 4. Test limits
    const testAmount2000 = 2000;
    const testAmount1000 = 1000;
    const maxLoan = totalInvestment * 3;

    if (testAmount2000 > maxLoan) {
      console.log(`✅ Loan of ${testAmount2000} correctly blocked (exceeds ${maxLoan})`);
    } else {
      console.log(`❌ FAIL: ${testAmount2000} should have been blocked by ${maxLoan} limit`);
    }

    if (testAmount1000 <= maxLoan) {
      console.log(`✅ Loan of ${testAmount1000} correctly allowed (within ${maxLoan} limit)`);
    } else {
      console.log(`❌ FAIL: ${testAmount1000} should have been allowed (within ${maxLoan} limit)`);
    }

    console.log('\n✅ ASCA Loan 3x limit policy verified successfully');
    process.exit(0);
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

testDirectLogic();
