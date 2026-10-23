const express = require('express');
const crypto = require('crypto');
const supabase = require('../db/supabaseClient');
const { wrap, httpError, toApi, isUuid } = require('../utils/helpers');
const { sign, requireScope } = require('../middleware/auth');

const router = express.Router();
const LIST_COLS = 'id,transfer_no,status,machine_name,sap_no,equipment_no,source_plant_name,destination_plant_name,receiver_email,sent_at,verified_at';

const digest = (v) => crypto.createHash('sha256').update(String(v)).digest();

router.post('/login', wrap(async (req, res) => {
  if (!process.env.ADMIN_PASSWORD) console.warn('WARNING: ADMIN_PASSWORD not set in .env — using default "admin123".');
  const expected = process.env.ADMIN_PASSWORD || 'admin123';
  const given = (req.body && req.body.password) || '';
  if (!crypto.timingSafeEqual(digest(given), digest(expected))) throw httpError(401, 'Incorrect admin password');
  res.json({ token: sign({ scope: 'admin' }, '12h') });
}));

const count = async (q) => {
  const { count: c, error } = await q;
  if (error) throw error;
  return c || 0;
};

router.get('/stats', requireScope('admin'), wrap(async (req, res) => {
  const total = await count(supabase.from('transfers').select('id', { count: 'exact', head: true }).neq('status', 'draft'));
  const pending = await count(supabase.from('transfers').select('id', { count: 'exact', head: true }).eq('status', 'pending'));
  res.json({ total, pending, verified: total - pending });
}));

router.get('/transfers', requireScope('admin'), wrap(async (req, res) => {
  const { data, error } = await supabase.from('transfers').select(LIST_COLS)
    .neq('status', 'draft').order('sent_at', { ascending: false }).limit(1000);
  if (error) throw error;
  const q = String(req.query.search || '').trim().toLowerCase();
  const rows = q
    ? data.filter((r) => [r.transfer_no, r.machine_name, r.sap_no, r.equipment_no, r.source_plant_name,
      r.destination_plant_name, r.receiver_email].some((v) => String(v || '').toLowerCase().includes(q)))
    : data;
  res.json(rows.map(toApi));
}));

router.get('/transfers/:id', requireScope('admin'), wrap(async (req, res) => {
  if (!isUuid(req.params.id)) throw httpError(404, 'Transfer not found');
  const { data, error } = await supabase.from('transfers').select('*').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!data || data.status === 'draft') throw httpError(404, 'Transfer not found');
  res.json(toApi(data));
}));

module.exports = router;