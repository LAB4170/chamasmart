const nodemailer = require('nodemailer');

const createTransporter = () => {
  // If credentials key is missing, incomplete, or set to default placeholders, we'll return null to signal "Console Mode"
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS ||
    process.env.EMAIL_USER === 'your_email@gmail.com' ||
    process.env.EMAIL_PASS === 'your_email_app_password') {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail', // Or use 'host', 'port' from env if more flexibility needed
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const sendInviteEmail = async (email, inviteLink, chamaName, inviterName) => {
  const transporter = createTransporter();

  console.log(`📧 Attempting to send invite to ${email}...`);

  if (!transporter) {
    console.log('⚠️ SMTP credentials not found (EMAIL_USER/EMAIL_PASS).');
    console.log('--- CONSOLE MODE: INVITE EMAIL ---');
    console.log(`To: ${email}`);
    console.log(`Subject: You're invited to join ${chamaName} on ChamaSmart`);
    console.log(`Message: Hello! ${inviterName} has invited you to join their investment group '${chamaName}'.`);
    console.log(`Link: ${inviteLink}`);
    console.log('---------------------------------');
    return { success: true, mode: 'CONSOLE' };
  }

  const mailOptions = {
    from: `"ChamaSmart" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `You're invited to join ${chamaName} on ChamaSmart`,
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4f46e5;">ChamaSmart Invitation</h2>
                <p>Hello,</p>
                <p><strong>${inviterName}</strong> has invited you to join their investment group, <strong>${chamaName}</strong>, on ChamaSmart.</p>
                <p>ChamaSmart helps groups manage their savings, loans, and investments transparently.</p>
                <br/>
                <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Accept Invitation</a>
                <br/><br/>
                <p style="color: #666; font-size: 14px;">If the button doesn't work, copy this link:</p>
                <p style="color: #666; font-size: 12px;">${inviteLink}</p>
            </div>
        `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Success: Invite email delivered to ${email}`);
    return { success: true, mode: 'SMTP' };
  } catch (error) {
    console.error(`❌ SMTP Error: Failed to deliver email to ${email}`);
    console.error(`Reason: ${error.message}`);
    // We throw the error so the controller can handle it (e.g., ROLLBACK)
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};

module.exports = {
  sendInviteEmail,
};
