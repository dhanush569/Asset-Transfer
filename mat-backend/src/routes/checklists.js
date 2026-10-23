const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { ELECTRICAL_CHECKLIST, MECHANICAL_CHECKLIST, MECHANICAL_OVERALL_STATUS_OPTIONS } = require('../utils/checklists');

const router = express.Router();
router.use(requireAuth);

// GET /api/checklists/electrical
router.get('/electrical', (req, res) => res.json(ELECTRICAL_CHECKLIST));

// GET /api/checklists/mechanical
router.get('/mechanical', (req, res) =>
  res.json({ categories: MECHANICAL_CHECKLIST, overallStatusOptions: MECHANICAL_OVERALL_STATUS_OPTIONS })
);

module.exports = router;
