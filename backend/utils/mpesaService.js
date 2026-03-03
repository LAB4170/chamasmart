const axios = require('axios');
const logger = require('./logger');

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.shortCode = process.env.MPESA_PAYBILL_OR_SHORTCODE;
    this.passkey = process.env.MPESA_PASSKEY;
    this.callbackUrl = process.env.MPESA_CALLBACK_URL;
    this.baseUrl = process.env.MPESA_ENVIRONMENT === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';
  }

  /**
   * Get OAuth Access Token from Daraja
   */
  async getAccessToken() {
    try {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });
      return response.data.access_token;
    } catch (error) {
      logger.error('M-Pesa OAuth failed', { error: error.response?.data || error.message });
      throw new Error('Failed to authenticate with M-Pesa');
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

      const response = await axios.post(`${this.baseUrl}/mpesa/stkpush/v1/query`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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

      const response = await axios.post(`${this.baseUrl}/mpesa/stkpushquery/v1/query`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
       logger.error('STK status query failed', { checkoutRequestId, error: error.response?.data || error.message });
       throw error;
    }
  }
}

module.exports = new MpesaService();
