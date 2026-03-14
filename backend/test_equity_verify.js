const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const CHAMA_ID = 19;
const USER_ID = 2; // Member with shares
const secret = process.env.JWT_SECRET || 'your_jwt_secret';
const token = jwt.sign({ id: USER_ID, sub: USER_ID, role: 'member' }, secret, { expiresIn: '1h' });

const baseUrl = 'http://localhost:5005/api';

const fs = require('fs');
let output = '';
const log = (msg) => {
    console.log(msg);
    output += msg + '\n';
};

async function verifyEquity() {
  log('--- ASCA Equity Verification Started ---');

  try {
    // 1. Get current equity
    const equityRes = await axios.get(`${baseUrl}/asca/${CHAMA_ID}/equity`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    log('✅ Equity Fetch: SUCCESS');
    // log('Equity Data: ' + JSON.stringify(equityRes.data.data, null, 2));

    const data = equityRes.data.data;
    const requiredFields = ['shares', 'value', 'percentage', 'currentSharePrice', 'totalAssets'];
    const missingFields = requiredFields.filter(f => data[f] === undefined);

    if (missingFields.length === 0) {
      log('✅ Field Alignment: SUCCESS (All expected fields present)');
      log(`   Fields: shares=${data.shares}, value=${data.value}, percentage=${data.percentage}%`);
    } else {
      log('❌ Field Alignment: FAILED. Missing fields: ' + missingFields.join(', '));
    }

    // 2. Logic Verification (Check if totalAssets > current_fund if there are loans)
    const chamaRes = await axios.get(`${baseUrl}/chamas/${CHAMA_ID}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const currentFund = parseFloat(chamaRes.data.data.current_fund);
    
    log(`   Current Fund: ${currentFund}, Total Assets: ${data.totalAssets}`);
    
    if (data.totalAssets >= currentFund) {
        log('✅ Asset Logic: SUCCESS (Total assets include fund balance)');
        if (data.totalAssets > currentFund) {
            log('   INFO: Assets include additional items (Loans/Assets)');
        }
    } else {
        log('❌ Asset Logic: FAILED (Total assets less than fund balance)');
    }

  } catch (err) {
    log('❌ Verification Error: ' + (err.response?.data?.message || err.message));
  }

  log('--- ASCA Equity Verification Completed ---');
  fs.writeFileSync('equity_verify_result.txt', output);
}

verifyEquity();
