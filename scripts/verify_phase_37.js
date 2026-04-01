/**
 * Verification Script for Phase 37: Multi-Tenant M-Pesa Routing
 * Checks if the controller correctly resolves custom payment details
 */

const path = require('path');

// Mock environment-sensitive modules before requiring controller
const mockPool = { query: async () => ({ rows: [] }), connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }) };
require.cache[require.resolve('../backend/config/db')] = { exports: mockPool };

// Mock Socket.io
require.cache[require.resolve('../backend/socket')] = { exports: { getIo: () => ({ to: () => ({ emit: () => {} }) }) } };

// Mock Groq/AI
require.cache[require.resolve('groq-sdk')] = { exports: class MockGroq { constructor() {} } };
require.cache[require.resolve('../backend/services/aiSupportService')] = { exports: {} };

// Mock TrustScoreService
require.cache[require.resolve('../backend/utils/trustScoreService')] = { exports: { updateMemberTrustScore: async () => {} } };

const mpesaService = require('../backend/utils/mpesaService');
const mpesaController = require('../backend/controllers/mpesaController');
const pool = require('../backend/config/db');

// Mocking the DB pool.query
const originalQuery = pool.query;

async function runVerification() {
  console.log('🧪 Starting Phase 37 Verification...');

  // Test Case 1: Custom Paybill
  console.log('\n--- Test Case 1: Custom Paybill ---');
  pool.query = async (text, params) => {
    if (text.includes('SELECT chama_type, payment_methods')) {
      return {
        rows: [{
          chama_type: 'ASCA',
          payment_methods: {
            type: 'PAYBILL',
            businessNumber: '543210',
            passKey: 'mock_passkey_123'
          }
        }]
      };
    }
    return { rows: [] };
  };

  // Capture the call to initiateStkPush
  const originalStkPush = mpesaService.initiateStkPush;
  let capturedConfig = null;
  mpesaService.initiateStkPush = async (phone, amount, ref, desc, config) => {
    capturedConfig = config;
    return { CheckoutRequestID: 'mock_id', isMock: false };
  };

  const req = { body: { chamaId: 1, amount: 100, phoneNumber: '254700000000' }, user: { user_id: 1 } };
  const res = { status: () => ({ json: () => {} }) };
  const next = () => {};

  await mpesaController.initiatePayment(req, res, next);

  if (capturedConfig && capturedConfig.shortCode === '543210' && capturedConfig.passKey === 'mock_passkey_123') {
    console.log('✅ PASS: Custom Paybill correctly resolved and passed to service.');
  } else {
    console.log('❌ FAIL: Custom Paybill resolution failed.', capturedConfig);
  }

  // Test Case 2: System Default Fallback
  console.log('\n--- Test Case 2: System Default Fallback ---');
  capturedConfig = null;
  pool.query = async (text, params) => {
    if (text.includes('SELECT chama_type, payment_methods')) {
      return { rows: [{ chama_type: 'ROSCA', payment_methods: {} }] };
    }
    return { rows: [] };
  };

  await mpesaController.initiatePayment(req, res, next);

  if (capturedConfig && Object.keys(capturedConfig).length === 0) {
    console.log('✅ PASS: System fallback correctly handled (empty config passed).');
  } else {
    console.log('❌ FAIL: System fallback failed.', capturedConfig);
  }

  // Cleanup
  pool.query = originalQuery;
  mpesaService.initiateStkPush = originalStkPush;
  console.log('\n🏁 Verification Complete.');
}

runVerification().catch(console.error);
