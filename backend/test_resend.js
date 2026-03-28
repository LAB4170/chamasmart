require('dotenv').config({path: './.env'});
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
  try {
    const { data, error } = await resend.emails.send({
      from: 'ChamaSmart <noreply@chamasmart-xcym.onrender.com>',
      to: 'lewisbosirec@gmail.com', // Replace with the user's email if possible
      subject: 'Test from ChamaSmart',
      html: '<p>Testing Resend integration.</p>'
    });
    console.log('API Response:', { data, error });
  } catch (e) {
    console.error('Exception:', e);
  }
}
test();
