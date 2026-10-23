const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../db/supabaseClient');
const { toCamel } = require('../utils/caseMap');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);

const ADMIN_ROLES = ['Super Admin', 'Plant Admin'];
const VALID_ROLES = ['Operator', 'Approver', 'Plant Admin', 'Super Admin'];

function sanitize(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// GET /api/users?plantId=&role=&active=true
router.get('/', asyncHandler(async (req, res) => {
  let query = supabase.from('users').select('*').order('created_at');
  const { plantId, role, active } = req.query;
  if (plantId) query = query.eq('plant_id', plantId);
  if (role) query = query.eq('role', role);
  if (active !== undefined) query = query.eq('active', active === 'true');

  const { data, error } = await query;
  if (error) throw error;
  res.json(data.map((row) => sanitize(toCamel(row))));
}));

// POST /api/users   { employeeId, name, plantId, role, password? }  — Admin only
router.post('/', requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const { employeeId, name, plantId, role, password } = req.body;
  if (!employeeId || !name || !plantId || !role) {
    return res.status(400).json({ error: 'employeeId, name, plantId and role are required' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
  }

  const { data: plant } = await supabase.from('plants').select('id').eq('id', plantId).maybeSingle();
  if (!plant) return res.status(404).json({ error: 'plantId does not match an existing plant' });

  const { data: existing } = await supabase.from('users').select('id').eq('employee_id', employeeId).maybeSingle();
  if (existing) return res.status(409).json({ error: `Employee ID ${employeeId} is already in use` });

  const { data, error } = await supabase
    .from('users')
    .insert({
      employee_id: employeeId,
      name,
      plant_id: plantId,
      role,
      active: true,
      password_hash: bcrypt.hashSync(password || 'password123', 10),
    })
    .select()
    .single();
  if (error) throw error;
  res.status(201).json(sanitize(toCamel(data)));
}));

// PATCH /api/users/:id   { name?, plantId?, role?, active? }  — Admin only
router.patch('/:id', requireRole(...ADMIN_ROLES), asyncHandler(async (req, res) => {
  const { data: existing } = await supabase.from('users').select('id').eq('id', req.params.id).maybeSingle();
  if (!existing) return res.status(404).json({ error: 'User not found' });

  const { name, plantId, role, active } = req.body;
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (plantId !== undefined) patch.plant_id = plantId;
  if (role !== undefined) {
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
    }
    patch.role = role;
  }
  if (active !== undefined) patch.active = active; // Active/Inactive toggle

  const { data, error } = await supabase.from('users').update(patch).eq('id', req.params.id).select().single();
  if (error) throw error;
  res.json(sanitize(toCamel(data)));
}));

module.exports = router;
