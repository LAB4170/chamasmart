const pool = require('./config/db');

async function wipeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Truncate all chama-related tables in correct order or with CASCADE
    console.log('Wiping all Chama-related data...');
    
    // Using CASCADE is safer to ensure all foreign key relationships are cleared
    await client.query(`
      TRUNCATE TABLE 
        chamas, 
        chama_members, 
        contributions, 
        loans, 
        loan_repayments,
        loan_guarantors,
        loan_schedules,
        loan_installments,
        meetings, 
        rosca_cycles,
        rosca_roster,
        rosca_swap_requests,
        payouts,
        notifications,
        audit_logs,
        financial_audit_logs,
        welfare_claims,
        welfare_claim_approvals,
        welfare_config,
        asca_cycles,
        asca_members,
        asca_share_contributions,
        proposals,
        invites,
        chama_invites,
        join_requests,
        mpesa_transactions,
        assets,
        votes
      RESTART IDENTITY CASCADE
    `);

    await client.query('COMMIT');
    console.log('✅ Database wiped successfully. You can now create fresh chamas.');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error wiping database:', err);
    process.exit(1);
  } finally {
    client.release();
  }
}

wipeDatabase();
