// Asset Receiver endpoints: transfer number + email -> emailed code -> access token.
const express = require('express');
const crypto = require('crypto');
const supabase = require('../db/supabaseClient');
const { wrap, httpError, toApi, str, cleanUrl } = require('../utils/helpers');
const { sign, requireScope } = require('../middleware/auth');
const { sendAccessCode, notifyVerification } = require('../utils/mailer');

const router = express.Router();
const CODE_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const attempts = new Map(); // transfer id -> { n, until }

const hashCode = (code, id) => crypto.createHash('sha256').update(`${code}:${id}`).digest('hex');

async function findTransfer(transferNo, email) {
  const { data, error } = await supabase.from('transfers')
    .select('id,transfer_no,status,receiver_email,access_code_hash,access_code_expires')
    .eq('transfer_no', transferNo).maybeSingle();
  if (error) throw error;
  if (!data || data.status === 'draft' || data.receiver_email !== email) {
    throw httpError(404, 'No sent transfer matches this transfer number and email');
  }
  return data;
}

router.post('/request-code', wrap(async (req, res) => {
  const transferNo = str(req.body && req.body.transferNo).toUpperCase();
  const email = str(req.body && req.body.email).toLowerCase();
  if (!transferNo || !email) throw httpError(400, 'Enter the transfer number and email');
  const t = await findTransfer(transferNo, email);

  const code = String(crypto.randomInt(100000, 1000000));
  const { error } = await supabase.from('transfers').update({
    access_code_hash: hashCode(code, t.id),
    access_code_expires: new Date(Date.now() + CODE_MINUTES * 60000).toISOString(),
  }).eq('id', t.id);
  if (error) throw error;
  attempts.delete(t.id);

  let mail;
  try {
    mail = await sendAccessCode(email, t.transfer_no, code);
  } catch (e) {
    console.error('Email send failed:', e.message);
    throw httpError(502, 'Could not send the email. Check the SMTP settings on the server.');
  }
  res.json({ ok: true, emailSent: !!mail.sent, devMode: !!mail.dev });
}));

router.post('/verify', wrap(async (req, res) => {
  const transferNo = str(req.body && req.body.transferNo).toUpperCase();
  const email = str(req.body && req.body.email).toLowerCase();
  const code = str(req.body && req.body.code);
  const t = await findTransfer(transferNo, email);

  const a = attempts.get(t.id);
  if (a && a.n >= MAX_ATTEMPTS && Date.now() < a.until) {
    throw httpError(429, 'Too many wrong attempts. Request a new code and try again.');
  }
  const valid = t.access_code_hash && t.access_code_expires
    && new Date(t.access_code_expires).getTime() > Date.now()
    && crypto.timingSafeEqual(Buffer.from(hashCode(code, t.id)), Buffer.from(t.access_code_hash));
  if (!valid) {
    const n = ((a && a.n) || 0) + 1;
    attempts.set(t.id, { n, until: Date.now() + CODE_MINUTES * 60000 });
    throw httpError(401, 'Invalid or expired code');
  }
  attempts.delete(t.id);
  await supabase.from('transfers').update({ access_code_hash: null, access_code_expires: null }).eq('id', t.id);
  res.json({ token: sign({ scope: 'receiver', tid: t.id }, '3h'), transferNo: t.transfer_no });
}));

async function loadOwn(req) {
  const { data, error } = await supabase.from('transfers').select('*').eq('id', req.auth.tid).maybeSingle();
  if (error) throw error;
  if (!data || data.status === 'draft') throw httpError(404, 'Transfer not found');
  return data;
}

function cleanReview(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) throw httpError(400, 'Invalid review');
  const out = {};
  for (const [k, v] of Object.entries(r).slice(0, 500)) {
    if (!/^[A-Za-z]+(\.\d+)?$/.test(k) || !v || typeof v !== 'object') continue;
    out[k] = { checked: !!v.checked, remark: str(v.remark).slice(0, 500), photoUrl: cleanUrl(v.photoUrl) };
  }
  return out;
}

router.get('/transfer', requireScope('receiver'), wrap(async (req, res) => {
  res.json(toApi(await loadOwn(req)));
}));

router.put('/review', requireScope('receiver'), wrap(async (req, res) => {
  const t = await loadOwn(req);
  if (t.status === 'verified') throw httpError(409, 'This transfer has already been submitted');
  const review = cleanReview(req.body && req.body.review);
  const { error } = await supabase.from('transfers').update({ receiver_review: review }).eq('id', t.id);
  if (error) throw error;
  res.json({ ok: true });
}));

router.post('/submit', requireScope('receiver'), wrap(async (req, res) => {
  const t = await loadOwn(req);
  if (t.status === 'verified') throw httpError(409, 'This transfer has already been submitted');
  const review = req.body && req.body.review ? cleanReview(req.body.review) : t.receiver_review;
  const { data, error } = await supabase.from('transfers')
    .update({ receiver_review: review, status: 'verified', verified_at: new Date().toISOString() })
    .eq('id', t.id).select().single();
  if (error) throw error;
  const mail = await notifyVerification(data, review);
  res.json({ ...toApi(data), providerNotified: !!mail.sent, mailDev: !!mail.dev });
}));

module.exports = router;