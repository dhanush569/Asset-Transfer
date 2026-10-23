const express = require('express');
const supabase = require('../db/supabaseClient');
const { toCamel } = require('../utils/caseMap');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);

// GET /api/companies
router.get('/', asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('companies').select('*').order('created_at');
  if (error) throw error;
  res.json(data.map(toCamel));
}));

// POST /api/companies   { name }   — Super Admin only
router.post('/', requireRole('Super Admin'), asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const { data, error } = await supabase.from('companies').insert({ name }).select().single();
  if (error) throw error;
  res.status(201).json(toCamel(data));
}));

module.exports = router;
