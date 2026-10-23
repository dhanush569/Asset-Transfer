const nodemailer = require('nodemailer');

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

// Returns { sent: true } when emailed. When SMTP is not configured (local dev),
// prints the code in the backend terminal and returns { sent: false }.
async function sendAccessCode(to, transferNo, code) {
  const t = getTransporter();
  if (!t) {
    console.log(`\n[MAIL DEV MODE] SMTP not configured. Access code for ${transferNo} -> ${to}: ${code}\n`);
    return { sent: false };
  }
  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: `Machine Asset Transfer ${transferNo} — your access code`,
    text: `Your access code for transfer ${transferNo} is ${code}.\nIt is valid for 15 minutes. Do not share it.`,
    html: `<div style="font-family:Arial,sans-serif"><p>Your access code for transfer <b>${transferNo}</b>:</p><p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p><p>Valid for 15 minutes. Do not share it.</p></div>`,
  });
  return { sent: true };
}

module.exports = { sendAccessCode };