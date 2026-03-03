const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { mpesaPaymentSchema } = require('../utils/validationSchemas');
const {
  initiatePayment,
  handleCallback
} = require('../controllers/mpesaController');
const { applyFinancialRateLimiting } = require('../middleware/rateLimiting');

// ============================================================================
// PUBLIC ROUTES (For Safaricom Callbacks)
// ============================================================================

router.post('/callback', handleCallback);

// ============================================================================
// PROTECTED ROUTES (For Members)
// ============================================================================

router.use(protect);

router.post(
  '/stk-push',
  applyFinancialRateLimiting,
  validate(mpesaPaymentSchema),
  initiatePayment
);

module.exports = router;
