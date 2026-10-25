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

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const appUrl = () => (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const fromAddr = () => process.env.MAIL_FROM || process.env.SMTP_USER;

// Sends one email. Without SMTP settings (local dev) it prints the email in the backend terminal.
async function deliver({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) {
    console.log(`\n[MAIL DEV MODE - SMTP not configured]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
    return { sent: false, dev: true };
  }
  await t.sendMail({ from: fromAddr(), to, subject, text, html });
  return { sent: true };
}

// Notification emails must never break the main action, so failures are logged and reported.
async function safe(payload) {
  try {
    return await deliver(payload);
  } catch (e) {
    console.error(`Email to ${payload.to} failed:`, e.message);
    return { sent: false, error: e.message };
  }
}

const shell = (title, inner) => `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#000;line-height:1.5">
<div style="padding:18px 0;border-bottom:3px solid #F0B31C;font-size:22px;font-weight:700;letter-spacing:2px">RANE</div>
<h2 style="font-size:18px;margin:22px 0 12px">${esc(title)}</h2>${inner}
<p style="color:#777;font-size:12px;margin-top:28px">Machine Asset Transfer &middot; automated message, please do not reply.</p></div>`;
const button = (href, label) => `<p><a href="${esc(href)}" style="display:inline-block;background:#000;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700">${esc(label)}</a></p>`;
const row = (k, v) => `<tr><td style="padding:4px 14px 4px 0;color:#555">${esc(k)}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`;

// 1. Receiver asks for an access code (throws on failure so the receiver sees the error)
async function sendAccessCode(to, transferNo, code) {
  return deliver({
    to,
    subject: `${transferNo} - your access code`,
    text: `Your access code for transfer ${transferNo} is ${code}.\nIt is valid for 15 minutes. Do not share it.`,
    html: shell(`Access code for ${transferNo}`,
      `<p>Use this code in the Asset Receiver page:</p><p style="font-size:30px;letter-spacing:8px;font-weight:700">${esc(code)}</p><p>Valid for 15 minutes. Do not share it.</p>`),
  });
}

// 2 + 3. Provider sends the request: tell the receiver, and confirm to the provider
async function notifyRequestSent(t) {
  const receiverUrl = `${appUrl()}/receiver`;
  const route = `${t.source_plant_name} -> ${t.destination_plant_name}`;
  const receiver = await safe({
    to: t.receiver_email,
    subject: `${t.transfer_no} - machine transfer awaiting your verification`,
    text: `A machine transfer is waiting for your verification.\n\nTransfer number: ${t.transfer_no}\nMachine: ${t.machine_name}\nRoute: ${route}\nSent by: ${t.provider_email}\n\nOpen ${receiverUrl}, enter the transfer number and this email address, and you will get an access code.`,
    html: shell('A machine transfer is waiting for your verification',
      `<table>${row('Transfer number', t.transfer_no)}${row('Machine', t.machine_name)}${row('Route', route)}${row('Sent by', t.provider_email)}</table>
<p>Open Asset Receiver, enter the transfer number and this email address, and you will receive an access code.</p>${button(receiverUrl, 'Open Asset Receiver')}`),
  });
  const provider = await safe({
    to: t.provider_email,
    subject: `${t.transfer_no} - transfer request sent`,
    text: `Your transfer request was sent.\n\nTransfer number: ${t.transfer_no}\nMachine: ${t.machine_name}\nRoute: ${route}\nReceiver email: ${t.receiver_email}\n\nYou will get another email when the receiver responds.`,
    html: shell('Your transfer request was sent',
      `<table>${row('Transfer number', t.transfer_no)}${row('Machine', t.machine_name)}${row('Route', route)}${row('Receiver email', t.receiver_email)}</table>
<p>You will get another email when the receiver responds.</p>`),
  });
  return { receiver, provider };
}

// Mirrors the receiver's review list so the email can summarise it.
function reviewSummary(t, review) {
  const r = review || {};
  const items = [];
  const add = (id, label, photo) => items.push({ id, label, photo: !!photo });
  add('machineName', 'Machine name'); add('sapNo', 'SAP number'); add('equipmentNo', 'Equipment number'); add('route', 'Transfer route');
  (t.machine_photos || []).forEach((p, i) => add(`mp.${i}`, p.label ? `${p.label} side photo` : `Machine photo ${i + 1}`, true));
  if (t.has_electrical) {
    (t.electrical_photos || []).forEach((p, i) => add(`ep.${i}`, `Electrical photo ${i + 1}`, true));
    (t.electrical_checklist || []).forEach((c, i) => add(`ec.${i}`, `Electrical: ${c.text}`));
  }
  if (t.has_mechanical) {
    (t.mechanical_photos || []).forEach((p, i) => add(`kp.${i}`, `Mechanical photo ${i + 1}`, true));
    (t.mechanical_checklist || []).forEach((c, i) => add(`mc.${i}`, `Mechanical: ${c.text}`));
    add('mechStatus', 'Overall mechanical status');
  }
  add('missing', 'Missing parameters');
  if (t.missing_photo_url) add('missingPhoto', 'Missing parameters photo', true);
  add('abn', 'Abnormalities');
  if (t.abnormality_photo_url) add('abnPhoto', 'Abnormality photo', true);
  const ok = (i) => r[i.id] && r[i.id].checked;
  return {
    total: items.length,
    ticked: items.filter(ok).length,
    notTicked: items.filter((i) => !ok(i)).map((i) => i.label),
    remarks: items.filter((i) => r[i.id] && r[i.id].remark).map((i) => ({ label: i.label, remark: r[i.id].remark })),
    photos: items.filter((i) => i.photo && r[i.id] && r[i.id].photoUrl).map((i) => ({ label: i.label, url: r[i.id].photoUrl })),
  };
}

// 4. Receiver submitted: tell the provider what the receiver said
async function notifyVerification(t, review) {
  const s = reviewSummary(t, review);
  const lines = [`Verified ${s.ticked} of ${s.total} items.`];
  if (s.notTicked.length) lines.push(`Not verified: ${s.notTicked.slice(0, 15).join('; ')}${s.notTicked.length > 15 ? '; ...' : ''}`);
  if (s.remarks.length) lines.push('Receiver remarks:', ...s.remarks.slice(0, 25).map((x) => `- ${x.label}: ${x.remark}`));
  if (s.photos.length) lines.push('Receiver photos:', ...s.photos.slice(0, 25).map((x) => `- ${x.label}: ${x.url}`));
  const list = (arr) => `<ul style="padding-left:18px;margin:6px 0">${arr.join('')}</ul>`;
  const html = shell(`The receiver has responded to ${t.transfer_no}`,
    `<table>${row('Machine', t.machine_name)}${row('Route', `${t.source_plant_name} -> ${t.destination_plant_name}`)}${row('Verified', `${s.ticked} of ${s.total} items`)}</table>`
    + (s.notTicked.length ? `<p><b>Not verified</b></p>${list(s.notTicked.slice(0, 15).map((x) => `<li>${esc(x)}</li>`))}` : '<p style="color:#1E7A46"><b>Every item was verified.</b></p>')
    + (s.remarks.length ? `<p><b>Receiver remarks</b></p>${list(s.remarks.slice(0, 25).map((x) => `<li>${esc(x.label)}: ${esc(x.remark)}</li>`))}` : '')
    + (s.photos.length ? `<p><b>Receiver photos</b></p>${list(s.photos.slice(0, 25).map((x) => `<li><a href="${esc(x.url)}">${esc(x.label)}</a></li>`))}` : ''));
  return safe({
    to: t.provider_email,
    subject: `${t.transfer_no} - receiver has responded`,
    text: `The receiver has responded to transfer ${t.transfer_no} (${t.machine_name}).\n\n${lines.join('\n')}`,
    html,
  });
}

module.exports = { getTransporter, deliver, sendAccessCode, notifyRequestSent, notifyVerification, reviewSummary };