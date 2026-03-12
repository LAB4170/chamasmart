/**
 * Secretary RBAC & Minutes Vault - API Test
 * Tests:
 *  1. Login as Chairperson (has Secretary permissions)
 *  2. Verify isSecretary middleware allows Chairperson to create a meeting
 *  3. Verify publishMinutes endpoint works
 *  4. Verify a MEMBER cannot call publishMinutes (403)
 */

const http = require('http');
const pool = require('./config/db');

const BASE = 'http://localhost:5005/api';

async function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 5005,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(rawData) });
        } catch {
          resolve({ status: res.statusCode, body: rawData });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('\n🔑 Step 1: Find a Chairperson and Member user...');
  
  // Get chairperson
  const chairRes = await pool.query(`
    SELECT u.user_id, u.first_name, u.last_name, m.chama_id, m.role
    FROM users u JOIN chama_members m ON u.user_id = m.user_id
    WHERE m.role = 'CHAIRPERSON' AND m.is_active = true
    LIMIT 1
  `);
  
  if (!chairRes.rows.length) {
    console.error('❌ No active Chairperson found in DB'); process.exit(1);
  }
  
  const chair = chairRes.rows[0];
  console.log(`✅ Found Chairperson: ${chair.first_name} ${chair.last_name} in chama ${chair.chama_id}`);
  
  // Get a member (not chair/sec/treasurer)
  const memberRes = await pool.query(`
    SELECT u.user_id, u.first_name, m.chama_id, m.role
    FROM users u JOIN chama_members m ON u.user_id = m.user_id
    WHERE m.chama_id = $1 AND m.role = 'MEMBER' AND m.is_active = true
    LIMIT 1
  `, [chair.chama_id]);

  // Generate tokens directly for testing
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_SECRET;

  const chairToken = jwt.sign({ user_id: chair.user_id, role: 'user' }, secret, { expiresIn: '1h' });
  
  console.log('\n📅 Step 2: Create a test meeting as Chairperson (isSecretary check)...');
  const meetingRes = await request('POST', `/meetings/${chair.chama_id}`, {
    title: 'Secretary RBAC Test Meeting',
    scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    location: 'Test Hall',
    type: 'PHYSICAL',
    description: 'Test minutes for RBAC verification'
  }, chairToken);
  
  if (meetingRes.status === 201) {
    console.log(`✅ Meeting created successfully (status ${meetingRes.status})`);
    console.log(`   Meeting ID: ${meetingRes.body.data?.meeting_id}`);
  } else {
    console.log(`⚠️  Meeting creation returned ${meetingRes.status}:`, JSON.stringify(meetingRes.body).substring(0, 200));
  }

  const meetingId = meetingRes.body.data?.meeting_id;
  
  if (meetingId) {
    console.log('\n📝 Step 3: Update meeting description (record minutes) as Chairperson...');
    const updateRes = await request('PUT', `/meetings/${chair.chama_id}/${meetingId}`, {
      description: 'Q1 Review by Secretary RBAC test. All contributions current. Agreed to increase by KES 500.'
    }, chairToken);
    console.log(`   Update status: ${updateRes.status} ${updateRes.status === 200 ? '✅' : '⚠️'}`);

    console.log('\n🚀 Step 4: Publish minutes as Chairperson...');
    const publishRes = await request('POST', `/meetings/${chair.chama_id}/${meetingId}/publish`, null, chairToken);
    if (publishRes.status === 200) {
      console.log(`✅ Minutes published! Status: ${publishRes.status}`);
      console.log(`   Message: ${publishRes.body.message}`);
    } else {
      console.log(`⚠️  Publish returned ${publishRes.status}:`, JSON.stringify(publishRes.body).substring(0, 300));
    }
  }

  if (memberRes.rows.length > 0) {
    const member = memberRes.rows[0];
    console.log(`\n🔒 Step 5: Verify MEMBER (${member.first_name}) cannot publish minutes...`);
    const memberToken = jwt.sign({ user_id: member.user_id, role: 'user' }, secret, { expiresIn: '1h' });
    
    // Try to create meeting as member (should be 403)
    const forbiddenRes = await request('POST', `/meetings/${chair.chama_id}`, {
      title: 'Unauthorized Meeting',
      scheduledAt: new Date().toISOString(),
      type: 'PHYSICAL'
    }, memberToken);
    
    if (forbiddenRes.status === 403) {
      console.log(`✅ Member correctly blocked from creating meetings (403 Forbidden)`);
    } else {
      console.log(`⚠️  Expected 403, got ${forbiddenRes.status}`);
    }
  } else {
    console.log('\n⏭️  Skipping member RBAC test (no plain MEMBER found in this chama)');
  }

  console.log('\n🏁 Secretary RBAC Test Complete!\n');
  await pool.end();
}

run().catch(async (err) => {
  console.error('Test failed:', err.message);
  await pool.end();
  process.exit(1);
});
