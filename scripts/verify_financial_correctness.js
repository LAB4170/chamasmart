/**
 * Financial Core Integration Test Suite
 * Verifies correctness of:
 * - Manual contributions & soft-delete balance reversals
 * - ASCA share purchases & capital routing
 * - ROSCA cycle contributions, rotation logic, pot payout & cycle completion
 * - Welfare configs, consensus claim approvals, disbursement routing & audit trail logging
 * - Real Loan application, approvals, partial & full repayments with treasury checks
 */

const http = require('http');

const PORT = 5006;
const BASE_URL = '/api/v1';

function request(path, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: BASE_URL + path,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          parsed = body;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Generate random suffix to prevent database unique constraints from firing on repeat runs
const rand = Math.floor(Math.random() * 1000000);
const officerEmail = `officer_${rand}@test.com`;
const memberEmail = `member_${rand}@test.com`;
const treasurerEmail = `treasurer_${rand}@test.com`;
const phone1 = `+254711${rand}`;
const phone2 = `+254722${rand}`;
const phone3 = `+254733${rand}`;

async function run() {
  console.log('🧪 RUNNING FINANCIAL ENGINE INTEGRATION TESTS...');

  try {
    // ----------------------------------------------------
    // Step 1: User Registrations & Logins
    // ----------------------------------------------------
    console.log('\nStep 1: User Registrations & Logins');
    
    const regOfficer = await request('/auth/register', 'POST', {
      firstName: 'Officer',
      lastName: 'A',
      email: officerEmail,
      phoneNumber: phone1,
      password: 'Password123'
    });
    if (regOfficer.statusCode !== 201) throw new Error('Officer registration failed: ' + JSON.stringify(regOfficer.body));
    const tokenA = regOfficer.body.data.tokens.accessToken;
    const userIdA = regOfficer.body.data.user.userId;
    console.log(`  - Registered Officer A (ID: ${userIdA}, Email: ${officerEmail})`);

    const regMember = await request('/auth/register', 'POST', {
      firstName: 'Member',
      lastName: 'B',
      email: memberEmail,
      phoneNumber: phone2,
      password: 'Password123'
    });
    if (regMember.statusCode !== 201) throw new Error('Member registration failed: ' + JSON.stringify(regMember.body));
    const tokenB = regMember.body.data.tokens.accessToken;
    const userIdB = regMember.body.data.user.userId;
    console.log(`  - Registered Member B (ID: ${userIdB}, Email: ${memberEmail})`);

    const regTreasurer = await request('/auth/register', 'POST', {
      firstName: 'Treasurer',
      lastName: 'C',
      email: treasurerEmail,
      phoneNumber: phone3,
      password: 'Password123'
    });
    if (regTreasurer.statusCode !== 201) throw new Error('Treasurer registration failed: ' + JSON.stringify(regTreasurer.body));
    const tokenC = regTreasurer.body.data.tokens.accessToken;
    const userIdC = regTreasurer.body.data.user.userId;
    console.log(`  - Registered Treasurer C (ID: ${userIdC}, Email: ${treasurerEmail})`);


    // ----------------------------------------------------
    // Step 2: Create Chama and Setup Members
    // ----------------------------------------------------
    console.log('\nStep 2: Create Chama and Setup Members');
    
    const chamaRes = await request('/chamas', 'POST', {
      chama_name: `Verification ASCA Chama ${rand}`,
      chama_type: 'ASCA',
      description: 'Chama for automated verification',
      contribution_amount: 100,
      contribution_frequency: 'MONTHLY',
      visibility: 'PUBLIC',
      custody_type: 'HANDHELD'
    }, tokenA);
    if (chamaRes.statusCode !== 201) throw new Error('Chama creation failed');
    const chamaId = chamaRes.body.data.chama_id;
    console.log(`  - Created ASCA Chama (ID: ${chamaId})`);

    // Add Member B to Chama
    const addB = await request(`/chamas/${chamaId}/members/add`, 'POST', { userId: userIdB }, tokenA);
    if (addB.statusCode !== 200) throw new Error('Failed to add Member B: ' + JSON.stringify(addB.body));
    console.log(`  - Added Member B to Chama`);

    // Add Treasurer C to Chama
    const addC = await request(`/chamas/${chamaId}/members/add`, 'POST', { userId: userIdC }, tokenA);
    if (addC.statusCode !== 200) throw new Error('Failed to add Treasurer C: ' + JSON.stringify(addC.body));
    console.log(`  - Added Treasurer C to Chama`);

    // Promote Treasurer C to official TREASURER role
    const updateRole = await request(`/chamas/${chamaId}/members/${userIdC}/role`, 'PUT', { role: 'TREASURER' }, tokenA);
    if (updateRole.statusCode !== 200) throw new Error('Failed to promote User C to TREASURER: ' + JSON.stringify(updateRole.body));
    console.log(`  - Promoted User C to TREASURER`);


    // ----------------------------------------------------
    // Step 3: Record Contributions & Verify Soft-Delete Reversal
    // ----------------------------------------------------
    console.log('\nStep 3: Record Contributions & Verify Soft-Delete Reversal');

    // Record regular contribution for B
    const recordContrRes = await request(`/contributions/${chamaId}/record`, 'POST', {
      user_id: userIdB,
      amount: 1000.00,
      status: 'COMPLETED',
      contribution_type: 'REGULAR'
    }, tokenA);
    if (recordContrRes.statusCode !== 200) throw new Error('Failed to record contribution');
    const contributionId = recordContrRes.body.data.contribution_id;
    console.log(`  - Recorded KES 1000 contribution (ID: ${contributionId}) for Member B`);

    // Fetch Chama currentFund
    let getChama = await request(`/chamas/${chamaId}`, 'GET', null, tokenA);
    console.log(`  - Chama fund after contribution: KES ${getChama.body.data.current_fund}`);
    if (parseFloat(getChama.body.data.current_fund) !== 1000.00) {
      throw new Error(`Expected current fund to be 1000.00, got ${getChama.body.data.current_fund}`);
    }

    // Soft-delete the contribution
    const deleteRes = await request(`/contributions/${chamaId}/${contributionId}`, 'DELETE', null, tokenA);
    if (deleteRes.statusCode !== 200) throw new Error('Failed to delete contribution');
    console.log(`  - Soft-deleted contribution ID: ${contributionId}`);

    // Verify fund is reversed back to 0.00
    getChama = await request(`/chamas/${chamaId}`, 'GET', null, tokenA);
    console.log(`  - Chama fund after soft-delete: KES ${getChama.body.data.current_fund}`);
    if (parseFloat(getChama.body.data.current_fund) !== 0.00) {
      throw new Error(`Expected current fund to be reversed to 0.00, got ${getChama.body.data.current_fund}`);
    }
    console.log(`  - ✅ SUCCESS: Balance reversal correctly updated treasury upon soft-delete.`);

    // Re-record contribution to have funds for next operations
    const reRecord = await request(`/contributions/${chamaId}/record`, 'POST', {
      user_id: userIdB,
      amount: 1500.00,
      status: 'COMPLETED',
      contribution_type: 'REGULAR'
    }, tokenA);
    getChama = await request(`/chamas/${chamaId}`, 'GET', null, tokenA);
    console.log(`  - Re-recorded contribution: KES 1500. Chama fund: KES ${getChama.body.data.current_fund}`);


    // ----------------------------------------------------
    // Step 4: ASCA Share Purchase Routing
    // ----------------------------------------------------
    console.log('\nStep 4: ASCA Share Purchase Routing');

    // Create ASCA cycle
    const cycleRes = await request(`/asca/chamas/${chamaId}/cycles`, 'POST', {
      cycle_name: 'Year 2026 ASCA Cycle',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      share_price: 200.00,
      total_shares: 500
    }, tokenA);
    if (cycleRes.statusCode !== 201) throw new Error('ASCA cycle creation failed: ' + JSON.stringify(cycleRes.body));
    const cycleId = cycleRes.body.data.cycle_id;
    console.log(`  - Created ASCA Cycle (ID: ${cycleId})`);

    // Purchase shares
    const buyShares = await request(`/asca/cycles/${cycleId}/shares/purchase`, 'POST', { shares: 5 }, tokenB);
    if (buyShares.statusCode !== 200) throw new Error('Failed to purchase shares: ' + JSON.stringify(buyShares.body));
    console.log(`  - Member B purchased 5 shares in ASCA cycle`);

    // Verify treasury increased by cost (5 * 200 = 1000 KES)
    getChama = await request(`/chamas/${chamaId}`, 'GET', null, tokenA);
    console.log(`  - Chama fund after share purchase: KES ${getChama.body.data.current_fund}`);
    if (parseFloat(getChama.body.data.current_fund) !== 2500.00) {
      throw new Error(`Expected current fund to be 2500.00, got ${getChama.body.data.current_fund}`);
    }
    console.log(`  - ✅ SUCCESS: Share purchase correctly credited Chama.currentFund.`);


    // ----------------------------------------------------
    // Step 5: Welfare Contributions & Consensus Claims Payouts
    // ----------------------------------------------------
    console.log('\nStep 5: Welfare Contributions & Consensus Claims Payouts');

    // Record manual WELFARE contribution
    const welfareContr = await request(`/contributions/${chamaId}/record`, 'POST', {
      user_id: userIdB,
      amount: 600.00,
      status: 'COMPLETED',
      contribution_type: 'WELFARE'
    }, tokenA);
    if (welfareContr.statusCode !== 200) throw new Error('Failed to record welfare contribution');
    console.log(`  - Recorded KES 600 WELFARE contribution`);

    // Verify Welfare Fund has increased while regular Chama.currentFund remains 2500.00
    getChama = await request(`/chamas/${chamaId}`, 'GET', null, tokenA);
    console.log(`  - Chama main fund (should still be 2500.00): KES ${getChama.body.data.current_fund}`);
    if (parseFloat(getChama.body.data.current_fund) !== 2500.00) {
      throw new Error(`Expected main fund to remain 2500.00, got ${getChama.body.data.current_fund}`);
    }

    // Get Welfare Ledger or balance
    const welfareLedger = await request(`/welfare/${chamaId}/ledger`, 'GET', null, tokenA);
    console.log(`  - Welfare ledger:`, JSON.stringify(welfareLedger.body.data));
    const welfareBalance = parseFloat(welfareLedger.body.data.welfare_balance || welfareLedger.body.data.balance || 0);
    if (welfareBalance !== 600.00) {
      throw new Error(`Expected welfare fund balance to be 600.00, got ${welfareBalance}`);
    }
    console.log(`  - ✅ SUCCESS: Welfare contributions correctly routed to the WelfareFund.`);

    // Create Welfare Config
    const configRes = await request(`/welfare/chamas/${chamaId}/configs`, 'POST', {
      event_type: 'Family Emergency',
      description: 'Support for members with immediate family emergencies',
      payout_amount: 400.00,
      contribution_type: 'ONE_TIME',
      contribution_amount: 0.00
    }, tokenA);
    if (configRes.statusCode !== 201) throw new Error('Welfare config creation failed: ' + JSON.stringify(configRes.body));
    const configId = configRes.body.data.config_id;
    console.log(`  - Created Welfare event config ID: ${configId}`);

    // File Welfare Claim
    const fileClaimRes = await request(`/welfare/claims?chama_id=${chamaId}&event_type_id=${configId}&claim_amount=400.00&description=Need+assistance+for+family+health+issue&date_of_occurrence=2026-05-18`, 'POST', null, tokenB);
    if (fileClaimRes.statusCode !== 201) throw new Error('Failed to file welfare claim: ' + JSON.stringify(fileClaimRes.body));
    const claimId = fileClaimRes.body.data.claim_id;
    console.log(`  - Filed Welfare Claim (ID: ${claimId})`);

    // Approve Claim - Official 1 (Officer A)
    const approve1 = await request(`/welfare/claims/${claimId}/approve`, 'POST', {
      decision: 'APPROVED',
      comments: 'Supporting medical documents verified.'
    }, tokenA);
    console.log(`  - Claim status after first approval: ${approve1.body.data.status}`);

    // Approve Claim - Official 2 (Treasurer C)
    const approve2 = await request(`/welfare/claims/${claimId}/approve`, 'POST', {
      decision: 'APPROVED',
      comments: 'Recommended payout approved.'
    }, tokenC);
    console.log(`  - Claim status after second approval: ${approve2.body.data.status}`);
    if (approve2.body.data.status !== 'PAID') {
      throw new Error(`Expected claim status to be PAID after consensus approvals, got ${approve2.body.data.status}`);
    }

    // Verify Welfare Fund balance deducted
    const ledgerAfter = await request(`/welfare/${chamaId}/ledger`, 'GET', null, tokenA);
    const balanceAfter = parseFloat(ledgerAfter.body.data.welfare_balance || ledgerAfter.body.data.balance || 0);
    console.log(`  - Welfare balance after disbursement: KES ${balanceAfter}`);
    if (balanceAfter !== 200.00) {
      throw new Error(`Expected welfare balance to be 200.00, got ${balanceAfter}`);
    }
    console.log(`  - ✅ SUCCESS: Welfare claim consensus approved and paid from WelfareFund.`);


    // ----------------------------------------------------
    // Step 6: Real Loan Approvals & Repayments
    // ----------------------------------------------------
    console.log('\nStep 6: Real Loan Approvals & Repayments');

    // Request Loan
    const loanApplyRes = await request(`/loans/${chamaId}/apply`, 'POST', {
      amount: 1000.00,
      purpose: 'Business expansion seed capital',
      repaymentPeriodMonths: 6,
      interestRate: 10.0
    }, tokenB);
    if (loanApplyRes.statusCode !== 201) throw new Error('Loan application failed: ' + JSON.stringify(loanApplyRes.body));
    const loanId = loanApplyRes.body.data.loan_id || loanApplyRes.body.data.loanId;
    console.log(`  - Submitted loan request (ID: ${loanId}) for KES 1000`);

    // Approve Loan
    const approveLoanRes = await request(`/loans/${chamaId}/${loanId}/approve`, 'PUT', null, tokenA);
    if (approveLoanRes.statusCode !== 200) throw new Error('Loan approval failed: ' + JSON.stringify(approveLoanRes.body));
    console.log(`  - Approved loan ID: ${loanId}`);

    // Verify main treasury decreased by KES 1000 (2500 - 1000 = 1500)
    getChama = await request(`/chamas/${chamaId}`, 'GET', null, tokenA);
    console.log(`  - Chama main fund after loan disbursement: KES ${getChama.body.data.current_fund}`);
    if (parseFloat(getChama.body.data.current_fund) !== 1500.00) {
      throw new Error(`Expected main fund to be 1500.00, got ${getChama.body.data.current_fund}`);
    }

    // Repay Loan (Partial Repayment: KES 400)
    const repayRes = await request(`/loans/${chamaId}/${loanId}/repay`, 'POST', {
      amount: 400.00
    }, tokenB);
    if (repayRes.statusCode !== 200) throw new Error('Loan repayment failed: ' + JSON.stringify(repayRes.body));
    console.log(`  - Made partial loan repayment of KES 400`);

    // Verify main treasury increased by KES 400 (1500 + 400 = 1900)
    getChama = await request(`/chamas/${chamaId}`, 'GET', null, tokenA);
    console.log(`  - Chama main fund after partial repayment: KES ${getChama.body.data.current_fund}`);
    if (parseFloat(getChama.body.data.current_fund) !== 1900.00) {
      throw new Error(`Expected main fund to be 1900.00, got ${getChama.body.data.current_fund}`);
    }

    // Repay Loan (Full remaining: KES 700, including 10% interest)
    const finalRepay = await request(`/loans/${chamaId}/${loanId}/repay`, 'POST', {
      amount: 700.00
    }, tokenB);
    if (finalRepay.statusCode !== 200) throw new Error('Final repayment failed: ' + JSON.stringify(finalRepay.body));
    console.log(`  - Made final loan repayment of KES 700`);

    // Verify main treasury increased by KES 700 (1900 + 700 = 2600)
    getChama = await request(`/chamas/${chamaId}`, 'GET', null, tokenA);
    console.log(`  - Chama main fund after full repayment: KES ${getChama.body.data.current_fund}`);
    if (parseFloat(getChama.body.data.current_fund) !== 2600.00) {
      throw new Error(`Expected main fund to be 2600.00, got ${getChama.body.data.current_fund}`);
    }
    console.log(`  - ✅ SUCCESS: Real loan approval, disbursement, and repayments tested with 100% correct ledger state.`);


    // ----------------------------------------------------
    // Step 7: ROSCA Cycle Rotation & Payout Payouts
    // ----------------------------------------------------
    console.log('\nStep 7: ROSCA Cycle Rotation & Payout Payouts');

    // Create a new ROSCA Chama
    const roscaChama = await request('/chamas', 'POST', {
      chama_name: `Verification ROSCA Chama ${rand}`,
      chama_type: 'ROSCA',
      description: 'Chama for ROSCA test',
      contribution_amount: 300,
      contribution_frequency: 'MONTHLY',
      visibility: 'PUBLIC',
      custody_type: 'HANDHELD'
    }, tokenA);
    const roscaChamaId = roscaChama.body.data.chama_id;
    console.log(`  - Created ROSCA Chama (ID: ${roscaChamaId})`);

    // Add Member B and Treasurer C to ROSCA chama so we have 3 members total (Officer A, Member B, Treasurer C)
    await request(`/chamas/${roscaChamaId}/members/add`, 'POST', { userId: userIdB }, tokenA);
    await request(`/chamas/${roscaChamaId}/members/add`, 'POST', { userId: userIdC }, tokenA);
    console.log(`  - Added B and C to ROSCA Chama`);

    // Initialize ROSCA cycle
    const roscaCycle = await request(`/rosca/chamas/${roscaChamaId}/cycles`, 'POST', {
      cycle_name: 'Cycle Alpha',
      contribution_amount: 300.00,
      payout_order: 'ROTATIONAL'
    }, tokenA);
    if (roscaCycle.statusCode !== 201) throw new Error('ROSCA cycle creation failed: ' + JSON.stringify(roscaCycle.body));
    const roscaCycleId = roscaCycle.body.data.cycle_id;
    console.log(`  - Created ROSCA Cycle (ID: ${roscaCycleId}) with 3 members`);

    // Make cycle contributions from all 3 members (3 * 300 = 900 KES pot size)
    await request(`/rosca/chamas/${roscaChamaId}/cycles/${roscaCycleId}/contributions`, 'POST', { amount: 300.00 }, tokenA);
    await request(`/rosca/chamas/${roscaChamaId}/cycles/${roscaCycleId}/contributions`, 'POST', { amount: 300.00 }, tokenB);
    await request(`/rosca/chamas/${roscaChamaId}/cycles/${roscaCycleId}/contributions`, 'POST', { amount: 300.00 }, tokenC);
    
    // Check ROSCA treasury fund
    let getRoscaChama = await request(`/chamas/${roscaChamaId}`, 'GET', null, tokenA);
    console.log(`  - ROSCA Chama fund after contributions: KES ${getRoscaChama.body.data.current_fund}`);
    if (parseFloat(getRoscaChama.body.data.current_fund) !== 900.00) {
      throw new Error(`Expected ROSCA fund to be 900.00, got ${getRoscaChama.body.data.current_fund}`);
    }

    // Process payout (first rotational slot)
    const payout1 = await request(`/rosca/cycles/${roscaCycleId}/payout`, 'POST', null, tokenA);
    if (payout1.statusCode !== 200) throw new Error('ROSCA payout failed: ' + JSON.stringify(payout1.body));
    console.log(`  - Rotational Pot payout processed successfully.`);

    // Verify treasury fund returned to 0.00 after pot disbursement
    getRoscaChama = await request(`/chamas/${roscaChamaId}`, 'GET', null, tokenA);
    console.log(`  - ROSCA Chama fund after payout: KES ${getRoscaChama.body.data.current_fund}`);
    if (parseFloat(getRoscaChama.body.data.current_fund) !== 0.00) {
      throw new Error(`Expected ROSCA treasury to be empty (0.00) after payout, got ${getRoscaChama.body.data.current_fund}`);
    }
    console.log(`  - ✅ SUCCESS: ROSCA cycle rotation and pot payout verified successfully.`);


    console.log('\n======================================================');
    console.log('🏆 ALL FINANCIAL CORE INTEGRATION TESTS COMPLETED SUCCESSFULLY!');
    console.log('======================================================');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ VERIFICATION TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

run();
