// Run: node src/utils/testMail.js you@example.com   (checks SMTP login and sends a test email)
require('dotenv').config();
const { getTransporter, deliver } = require('./mailer');

(async () => {
  const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter((k) => !process.env[k]);
  if (missing.length) {
    console.log('Email is NOT configured. Add these to mat-backend/.env:', missing.join(', '));
    process.exitCode = 1;
    return;
  }
  const to = process.argv[2] || process.env.SMTP_USER;
  try {
    await getTransporter().verify();
    console.log('SMTP login OK. Sending a test email to', to, '...');
    await deliver({ to, subject: 'RANE test email', text: 'Email is working.', html: '<p><b>RANE</b> - email is working.</p>' });
    console.log('Test email sent. Check the inbox (and spam).');
  } catch (e) {
    console.log('Email FAILED:', e.message);
    process.exitCode = 1;
  }
})();