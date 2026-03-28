const { Resend } = require('resend');

/**
 * ChamaSmart Email Service
 * Supports Resend (Primary) and Console (Fallback/Dev).
 */
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === 're_your_api_key' || apiKey.length < 10) {
    return null;
  }
  return new Resend(apiKey);
};

const sendInviteEmail = async (email, inviteLink, chamaName, inviterName) => {
  const resend = getResendClient();

  console.log(`📧 Processing invite for ${email}...`);

  if (!resend) {
    console.log('⚠️ RESEND_API_KEY not found or invalid. Falling back to Console Mode.');
    console.log('--- CONSOLE MODE: INVITE EMAIL ---');
    console.log(`To: ${email}`);
    console.log(`Subject: Join ${chamaName} on ChamaSmart`);
    console.log(`Message: Hello! ${inviterName} has invited you to join '${chamaName}'.`);
    console.log(`Link: ${inviteLink}`);
    console.log('---------------------------------');
    return { success: true, mode: 'CONSOLE' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'ChamaSmart <onboarding@resend.dev>', // You must use this until you verify a custom domain via DNS
      to: email,
      subject: `You're invited to join ${chamaName} on ChamaSmart`,
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
          <div style="background: #1e293b; padding: 40px 20px; text-align: center; border-radius: 16px 16px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800;">ChamaSmart</h1>
            <p style="color: rgba(255,255,255,0.9); margin-top: 8px;">The Intelligent Investment Ecosystem</p>
          </div>
          
          <div style="padding: 32px; background: white; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
            <h2 style="font-size: 20px; margin-bottom: 16px;">Hello!</h2>
            <p><strong>${inviterName}</strong> has invited you to join their investment group, <span style="color: #1e293b; font-weight: 700;">${chamaName}</span>, on ChamaSmart.</p>
            
            <p style="margin: 24px 0;">ChamaSmart helps groups manage their savings, loans, and investments with AI-powered transparency and institutional-grade security.</p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${inviteLink}" style="background-color: #1e293b; color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px; font-weight: 700; display: inline-block; box-shadow: 0 4px 6px -1px rgba(30, 41, 59, 0.4);">
                Accept Invitation
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px; text-align: center;">If the button doesn't work, copy and paste this link:</p>
            <p style="color: #94a3b8; font-size: 12px; word-break: break-all; text-align: center; padding: 12px; background: #f8fafc; border-radius: 8px;">
              ${inviteLink}
            </p>
          </div>
          
          <div style="text-align: center; padding: 24px; color: #94a3b8; font-size: 12px;">
            &copy; 2026 ChamaSmart. Empowering groups with financial intelligence.
          </div>
        </div>
      `,
    });

    if (error) {
      throw new Error(error.message);
    }

    console.log(`✅ Success: Invite email sent to ${email} (ID: ${data.id})`);
    return { success: true, mode: 'RESEND', id: data.id };
  } catch (error) {
    console.error(`❌ Resend Error: Failed to send email to ${email}`);
    console.error(`Reason: ${error.message}`);
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};

module.exports = {
  sendInviteEmail,
};
