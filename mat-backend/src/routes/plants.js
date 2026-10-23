const express = require('express');
const supabase = require('../db/supabaseClient');
const { wrap, httpError, toApi, str, isUuid } = require('../utils/helpers');
const { requireScope } = require('../middleware/auth');

const router = express.Router();

// Public: providers need the list to pick source/destination plants.
router.get('/', wrap(async (req, res) => {
  const { data, error } = await supabase.from('plants').select('*').order('name', { ascending: true });
  if (error) throw error;
  res.json(data.map(toApi));
}));

router.post('/', requireScope('admin'), wrap(async (req, res) => {
  const name = str(req.body && req.body.name).slice(0, 80);
  const code = str(req.body && req.body.code).toUpperCase().slice(0, 20);
  if (!name || !code) throw httpError(400, 'Plant name and plant code are required');
  const { data, error } = await supabase.from('plants').insert({ name, code }).select().single();
  if (error) {
    if (error.code === '23505') throw httpError(409, 'A plant with this name already exists');
    throw error;
  }
  res.status(201).json(toApi(data));
}));

// Past transfers keep the plant name (stored as text), so deleting is always safe.
router.delete('/:id', requireScope('admin'), wrap(async (req, res) => {
  if (!isUuid(req.params.id)) throw httpError(404, 'Plant not found');
  const { error } = await supabase.from('plants').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ ok: true });
}));

module.exports = router;