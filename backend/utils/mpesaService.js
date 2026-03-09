const axios = require('axios');
const logger = require('./logger');

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.shortCode = process.env.MPESA_SHORTCODE || process.env.MPESA_PAYBILL_OR_SHORTCODE;
    this.passkey = process.env.MPESA_PASSKEY;
    this.callbackUrl = process.env.MPESA_CALLBACK_URL;
    this.baseUrl = (process.env.MPESA_ENVIRONMENT || process.env.MPESA_ENV) === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
    this.isMock = process.env.MPESA_MOCK === 'true' || process.env.NODE_ENV === 'test';

    // Production safety guard — fail fast if mock is on in prod
    if (this.isMock && process.env.NODE_ENV === 'production') {
      throw new Error('[FATAL] MPESA_MOCK=true is not allowed in production. Unset it before deploying.');
    }
    if (this.isMock) {
      logger.warn('⚠️  M-Pesa MOCK MODE is ACTIVE — no real M-Pesa transactions will occur');
    }
  }

  /**
   * Get OAuth Access Token from Daraja
   */
  async getAccessToken() {
    try {
      if (this.isMock) {
        logger.info('M-Pesa Mock: Generating access token');
        return 'mock_access_token_' + Date.now();
      }

      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
        timeout: 10000,
      });
      return response.data.access_token;
    } catch (error) {
      logger.error('M-Pesa OAuth failed', { error: error.response?.data || error.message });
      // Preserve the error code and response data for the controller
      const authError = new Error(error.message || 'Failed to authenticate with M-Pesa');
      authError.code = error.code;
      authError.response = error.response;
      throw authError;
    }
  }

  /**
   * Initiate STK Push (Lipa Na M-Pesa Online)
   */
  async initiateStkPush(phoneNumber, amount, accountReference, transactionDesc) {
    try {
      const token = await this.getAccessToken();
      const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
      const password = Buffer.from(`${this.shortCode}${this.passkey}${timestamp}`).toString('base64');

      // Normalize phone number to 2547XXXXXXXX
      let formattedPhone = phoneNumber.replace(/\+/g, '');
      if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);
      if (formattedPhone.startsWith('7') || formattedPhone.startsWith('1')) formattedPhone = '254' + formattedPhone;

      const payload = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: this.shortCode,
        PhoneNumber: formattedPhone,
        CallBackURL: this.callbackUrl,
        AccountReference: accountReference.substring(0, 12),
        TransactionDesc: transactionDesc.substring(0, 20),
      };

      if (this.isMock) {
        logger.info('M-Pesa Mock: Initiating STK push', { phoneNumber, amount });
        // Simulate a small delay
        await new Promise(resolve => setTimeout(resolve, 800));
        return {
          MerchantRequestID: 'mock_merchant_' + Date.now(),
          CheckoutRequestID: 'mock_checkout_' + Date.now(),
          ResponseCode: '0',
          ResponseDescription: 'Success. Request accepted for processing',
          CustomerMessage: 'Success. Request accepted for processing',
          isMock: true
        };
      }

      const response = await axios.post(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      logger.error('STK Push initiation failed', { error: error.response?.data || error.message });
      throw error;
    }
  }

  /**
   * Query STK Push status (Fallback handle)
   */
  async queryStatus(checkoutRequestId) {
    try {
      const token = await this.getAccessToken();
      const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
      const password = Buffer.from(`${this.shortCode}${this.passkey}${timestamp}`).toString('base64');

      const payload = {
        BusinessShortCode: this.shortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      };

      if (this.isMock) {
        logger.info('M-Pesa Mock: Querying status', { checkoutRequestId });
        return {
          ResponseCode: '0',
          ResponseDescription: 'The service request has been accepted successfully',
          MerchantRequestID: 'mock_merchant_' + Date.now(),
          CheckoutRequestID: checkoutRequestId,
          ResultCode: '0',
          ResultDesc: 'The service request is processed successfully.',
          isMock: true
        };
      }

      const response = await axios.post(`${this.baseUrl}/mpesa/stkpushquery/v1/query`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
       logger.error('STK status query failed', { checkoutRequestId, error: error.response?.data || error.message });
       throw error;
    }
  }

  /**
   * Simulate an M-Pesa callback payload for mock mode testing.
   * Enables full E2E dev testing without a live Safaricom connection.
   */
  async simulateMockCallback(checkoutRequestId, amount, phoneNumber) {
    if (!this.isMock) throw new Error('simulateMockCallback is only available in mock mode');
    logger.info('M-Pesa Mock: Simulating Safaricom callback', { checkoutRequestId });
    await new Promise(r => setTimeout(r, 500)); // Simulate async timing
    return {
      Body: {
        stkCallback: {
          MerchantRequestID: 'mock_merchant_' + Date.now(),
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: parseFloat(amount) },
              { Name: 'MpesaReceiptNumber', Value: 'MOCK' + Date.now() },
              { Name: 'TransactionDate', Value: Date.now() },
              { Name: 'PhoneNumber', Value: phoneNumber }
            ]
          }
        }
      }
    };
  }
}

module.exports = new MpesaService();
