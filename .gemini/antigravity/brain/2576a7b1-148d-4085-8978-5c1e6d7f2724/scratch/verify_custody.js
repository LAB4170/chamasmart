const API_URL = 'http://localhost:5006/api/v1';

async function run() {
  console.log('🧪 Starting Chama Custody verification tests...');

  let token = null;

  // 1. Try to Register
  try {
    const regRes = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Custody',
        lastName: 'Tester',
        email: `tester_${Date.now()}@chamas.com`,
        phoneNumber: `2547${Math.floor(10000000 + Math.random() * 90000000)}`,
        password: 'password123'
      })
    });
    const regData = await regRes.json();
    if (regData.success) {
      token = regData.data.tokens.accessToken;
      console.log('✅ Registered new test user');
    }
  } catch (err) {
    console.error('Registration failed/skipped:', err.message);
  }

  // Fallback: Login if register didn't work (or if we want a static fallback)
  if (!token) {
    console.log('🔑 Trying login fallback...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'treasurer@example.com', // use an existing user if any
        password: 'password123'
      })
    });
    const loginData = await loginRes.json();
    if (loginData.success) {
      token = loginData.data.tokens.accessToken;
      console.log('✅ Logged in successfully via treasurer account');
    } else {
      console.error('❌ Authentication failed completely:', loginData);
      process.exit(1);
    }
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Test Case A: Create MANAGED Custody Chama
  console.log('\n--- Test Case A: Create MANAGED Custody Chama ---');
  const managedPayload = {
    chama_name: `Managed Chama ${Date.now()}`,
    chama_type: 'ROSCA',
    description: 'A platform-managed automated vault',
    contribution_amount: 1200,
    contribution_frequency: 'MONTHLY',
    visibility: 'PRIVATE',
    custody_type: 'MANAGED',
    payment_methods: null
  };

  const resA = await fetch(`${API_URL}/chamas`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(managedPayload)
  });
  const dataA = await resA.json();

  if (dataA.success) {
    console.log('✅ Create MANAGED Chama Success!');
    console.log('Chama ID:', dataA.data.chama_id);
    console.log('Custody Type:', dataA.data.custody_type);
    console.log('Virtual Account Ref:', dataA.data.virtual_account_ref);
    console.log('Payment Methods:', dataA.data.payment_methods);

    if (dataA.data.custody_type === 'MANAGED' && dataA.data.virtual_account_ref.startsWith('CS-')) {
      console.log('🎉 PASS: Custody type and Virtual Account Ref resolved correctly!');
    } else {
      console.log('❌ FAIL: Managed custody fields validation failed.');
    }
  } else {
    console.error('❌ Failed to create managed Chama:', dataA);
  }

  // 3. Test Case B: Create SELF_MANAGED Custody Chama
  console.log('\n--- Test Case B: Create SELF_MANAGED Custody Chama ---');
  const selfManagedPayload = {
    chama_name: `Self-Managed Chama ${Date.now()}`,
    chama_type: 'ASCA',
    description: 'A treasurer-managed self custody vault',
    contribution_amount: 2500,
    contribution_frequency: 'MONTHLY',
    share_price: 250,
    visibility: 'PRIVATE',
    custody_type: 'SELF_MANAGED',
    payment_methods: {
      type: 'PAYBILL',
      businessNumber: '555444',
      accountNumber: 'GROUP_GOLD'
    }
  };

  const resB = await fetch(`${API_URL}/chamas`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(selfManagedPayload)
  });
  const dataB = await resB.json();

  if (dataB.success) {
    console.log('✅ Create SELF_MANAGED Chama Success!');
    console.log('Chama ID:', dataB.data.chama_id);
    console.log('Custody Type:', dataB.data.custody_type);
    console.log('Virtual Account Ref:', dataB.data.virtual_account_ref);
    console.log('Payment Methods:', dataB.data.payment_methods);

    if (dataB.data.custody_type === 'SELF_MANAGED' && dataB.data.payment_methods.businessNumber === '555444') {
      console.log('🎉 PASS: Self-Managed custody and Payment configurations stored successfully!');
    } else {
      console.log('❌ FAIL: Self-Managed custody validation failed.');
    }
  } else {
    console.error('❌ Failed to create self-managed Chama:', dataB);
  }

  // 4. Validate retrieval mapping via user's my-chamas endpoint
  console.log('\n--- Test Case C: Retrieve user chamas and verify details mapping ---');
  const resC = await fetch(`${API_URL}/chamas/user/my-chamas`, {
    method: 'GET',
    headers: authHeaders
  });
  const dataC = await resC.json();

  if (dataC.success && Array.isArray(dataC.data)) {
    console.log(`Fetched ${dataC.data.length} chamas for current user.`);
    const managedChama = dataC.data.find(c => c.chama_id === dataA.data.chama_id);
    const selfManagedChama = dataC.data.find(c => c.chama_id === dataB.data.chama_id);

    if (managedChama) {
      console.log('Managed Chama retrieved:', {
        chama_id: managedChama.chama_id,
        custody_type: managedChama.custody_type,
        virtual_account_ref: managedChama.virtual_account_ref,
        payment_methods: managedChama.payment_methods
      });
      if (managedChama.custody_type === 'MANAGED' && managedChama.payment_methods === null) {
        console.log('🎉 PASS: Retrieve MANAGED maps custody and payment details correctly');
      } else {
        console.log('❌ FAIL: Retrieve MANAGED mapped values incorrect');
      }
    }

    if (selfManagedChama) {
      console.log('Self-Managed Chama retrieved:', {
        chama_id: selfManagedChama.chama_id,
        custody_type: selfManagedChama.custody_type,
        virtual_account_ref: selfManagedChama.virtual_account_ref,
        payment_methods: selfManagedChama.payment_methods
      });
      if (selfManagedChama.custody_type === 'SELF_MANAGED' && selfManagedChama.payment_methods.businessNumber === '555444') {
        console.log('🎉 PASS: Retrieve SELF_MANAGED maps custody and payment details correctly');
      } else {
        console.log('❌ FAIL: Retrieve SELF_MANAGED mapped values incorrect');
      }
    }
  } else {
    console.error('❌ Failed to fetch user chamas:', dataC);
  }
}

run().catch(console.error);
