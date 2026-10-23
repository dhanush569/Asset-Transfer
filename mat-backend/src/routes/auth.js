const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const supabase = require('../db/supabaseClient');
const { toCamel } = require('../utils/caseMap');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

function sanitize(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// POST /api/auth/login  { employeeId, password }
router.post('/login', asyncHandler(async (req, res) => {
  const { employeeId, password } = req.body;
  if (!employeeId || !password) {
    return res.status(400).json({ error: 'employeeId and password are required' });
  }

  const { data, error } = await supabase.from('users').select('*').eq('employee_id', employeeId).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(401).json({ error: 'Invalid Employee ID or password' });

  const user = toCamel(data);
  if (!user.active) return res.status(403).json({ error: 'This account is inactive' });

  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid Employee ID or password' });

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  });

  res.json({ token, user: sanitize(user) });
}));

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json(sanitize(req.user));
});

module.exports = router;
