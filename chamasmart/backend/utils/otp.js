/**
 * OTP Utilities - Email & SMS OTP handling
 */

const nodemailer = require('nodemailer');
const logger = require('./logger');

// ============================================================================
// EMAIL OTP HANDLER
// ============================================================================

class EmailOTP {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async send(email, otp, userName = 'User') {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #2c3e50; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background-color: #f8f9fa; padding: 30px; text-align: center; }
              .otp-box { background-color: white; border: 2px solid #3498db; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .otp-code { font-size: 32px; font-weight: bold; color: #3498db; letter-spacing: 5px; }
              .footer { background-color: #ecf0f1; padding: 15px; border-radius: 0 0 8px 8px; font-size: 12px; color: #7f8c8d; }
              .warning { color: #e74c3c; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎯 ChamaSmart - Verification Code</h1>
              </div>
              <div class="content">
                <p>Hi ${userName},</p>
                <p>Your ChamaSmart verification code is:</p>
                <div class="otp-box">
                  <div class="otp-code">${otp}</div>
                </div>
                <p>This code will expire in 10 minutes.</p>
                <p class="warning">⚠️ Never share this code with anyone. ChamaSmart staff will never ask for it.</p>
              </div>
              <div class="footer">
                <p>If you didn't request this code, please ignore this email.</p>
                <p>&copy; 2025 ChamaSmart. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const result = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: email,
        subject: `Your ChamaSmart Verification Code: ${otp}`,
        html: htmlContent,
        text: `Your ChamaSmart verification code is: ${otp}. It will expire in 10 minutes.`,
      });

      logger.info('📧 OTP email sent', {
        email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
        messageId: result.messageId,
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Failed to send OTP email', error);
      return { success: false, error: error.message };
    }
  }
}

// ============================================================================
// SMS OTP HANDLER (Placeholder for Twilio/Africa's Talking)
// ============================================================================

class SMSOTP {
  constructor(provider = 'twilio') {
    this.provider = provider;

    if (provider === 'twilio') {
      this.accountSid = process.env.TWILIO_ACCOUNT_SID;
      this.authToken = process.env.TWILIO_AUTH_TOKEN;
      this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
      // In production, initialize Twilio client
      // this.twilioClient = require('twilio')(this.accountSid, this.authToken);
    } else if (provider === 'africas_talking') {
      this.apiKey = process.env.AFRICAS_TALKING_API_KEY;
      this.username = process.env.AFRICAS_TALKING_USERNAME;
      // In production, initialize Africa's Talking client
      // this.client = require('africastalking')({ apiKey: this.apiKey, username: this.username });
    }
  }

  async send(phone, otp, countryCode = '+254') {
    try {
      const formattedPhone = this.formatPhoneNumber(phone, countryCode);
      const message = `Your ChamaSmart verification code is: ${otp}. Valid for 10 minutes. Never share this code.`;

      if (this.provider === 'twilio') {
        return await this.sendViaTwilio(formattedPhone, message, otp);
      } if (this.provider === 'africas_talking') {
        return await this.sendViaAfricasTalking(formattedPhone, message, otp);
      }
      // Development mode - log to console
      logger.info('📱 [DEV] SMS OTP would be sent', {
        phone: this.maskPhone(phone),
        otp: process.env.NODE_ENV === 'development' ? otp : '***',
        message,
      });
      return { success: true, dev: true };
    } catch (error) {
      logger.error('Failed to send SMS OTP', error);
      return { success: false, error: error.message };
    }
  }

  formatPhoneNumber(phone, countryCode) {
    // Remove any non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // If starts with 0, replace with country code
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.slice(1);
    }

    // Add country code if not present
    if (!cleaned.startsWith(countryCode.replace('+', ''))) {
      cleaned = countryCode.replace('+', '') + cleaned;
    }

    return `+${cleaned}`;
  }

  maskPhone(phone) {
    return `${phone.slice(0, 4)}****${phone.slice(-2)}`;
  }

  async sendViaTwilio(phone, message, otp) {
    // TODO: Implement Twilio integration
    logger.warn('⚠️ Twilio SMS OTP not yet configured', {
      phone: this.maskPhone(phone),
    });
    return { success: false, error: 'Twilio not configured' };
  }

  async sendViaAfricasTalking(phone, message, otp) {
    // TODO: Implement Africa's Talking integration
    logger.warn('⚠️ Africa\'s Talking SMS OTP not yet configured', {
      phone: this.maskPhone(phone),
    });
    return { success: false, error: 'Africa\'s Talking not configured' };
  }
}

// ============================================================================
// OTP GENERATOR
// ============================================================================

class OTPGenerator {
  static numeric(length = 6) {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += digits[Math.floor(Math.random() * digits.length)];
    }
    return code;
  }

  static alphanumeric(length = 8) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  static generateWithExpiry(length = 6, expiryMinutes = 10) {
    return {
      code: this.numeric(length),
      expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
      expiryMinutes,
    };
  }

  static isExpired(expiryTime) {
    return new Date() > new Date(expiryTime);
  }

  static timeUntilExpiry(expiryTime) {
    const now = new Date();
    const expiry = new Date(expiryTime);
    const diffMs = expiry - now;
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    return { minutes: diffMins, seconds: diffSecs, expired: diffMs < 0 };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  EmailOTP,
  SMSOTP,
  OTPGenerator,
};
