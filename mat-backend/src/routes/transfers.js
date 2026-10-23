// Asset Provider endpoints (no login). A draft is only reachable by its unguessable id.
const express = require('express');
const supabase = require('../db/supabaseClient');
const { wrap, httpError, toApi, str, cleanUrl, isUuid, genTransferNo } = require('../utils/helpers');
const {
  ELECTRICAL_ITEMS, MECHANICAL_ITEMS, MECHANICAL_STATUS_OPTIONS, instantiate,
} = require('../utils/checklists');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getPlant(id) {
  if (!isUuid(id)) return null;
  const { data } = await supabase.from('plants').select('id,name').eq('id', id).maybeSingle();
  return data || null;
}

async function getDraft(id) {
  if (!isUuid(id)) throw httpError(404, 'Transfer not found');
  const { data, error } = await supabase.from('transfers').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data || data.status !== 'draft') throw httpError(404, 'Transfer not found');
  return data;
}

const cleanPhotos = (arr) => {
  if (!Array.isArray(arr)) throw httpError(400, 'Invalid photo list');
  return arr.slice(0, 40).map((p) => ({
    label: str(p && p.label).slice(0, 60),
    url: cleanUrl(p && p.url),
    remark: str(p && p.remark).slice(0, 500),
  }));
};

const cleanChecklist = (arr) => {
  if (!Array.isArray(arr)) throw httpError(400, 'Invalid checklist');
  return arr.slice(0, 60).map((c) => ({
    text: str(c && c.text).slice(0, 300),
    checked: !!(c && c.checked),
    remark: str(c && c.remark).slice(0, 500),
  }));
};

// Step 1: machine details -> creates the draft and auto-generates the transfer number.
router.post('/', wrap(async (req, res) => {
  const b = req.body || {};
  const machineName = str(b.machineName).slice(0, 200);
  const sapNo = str(b.sapNo).slice(0, 100);
  const equipmentNo = str(b.equipmentNo).slice(0, 100);
  const receiverEmail = str(b.receiverEmail).toLowerCase().slice(0, 200);
  if (!machineName || !sapNo || !equipmentNo) throw httpError(400, 'Machine name, SAP number and equipment number are required');
  if (!EMAIL_RE.test(receiverEmail)) throw httpError(400, 'Enter a valid receiver email');
  const [src, dst] = await Promise.all([getPlant(b.sourcePlantId), getPlant(b.destinationPlantId)]);
  if (!src || !dst) throw httpError(400, 'Select valid source and destination plants');
  if (src.id === dst.id) throw httpError(400, 'Source and destination plants must be different');

  for (let attempt = 0; attempt < 6; attempt++) {
    const row = {
      transfer_no: genTransferNo(),
      machine_name: machineName,
      sap_no: sapNo,
      equipment_no: equipmentNo,
      source_plant_id: src.id,
      source_plant_name: src.name,
      destination_plant_id: dst.id,
      destination_plant_name: dst.name,
      receiver_email: receiverEmail,
      machine_photos: ['Front', 'Back', 'Left', 'Right'].map((label) => ({ label, url: '', remark: '' })),
      electrical_checklist: instantiate(ELECTRICAL_ITEMS),
      mechanical_checklist: instantiate(MECHANICAL_ITEMS),
    };
    const { data, error } = await supabase.from('transfers').insert(row).select().single();
    if (!error) return res.status(201).json(toApi(data));
    if (error.code !== '23505') throw error;
  }
  throw httpError(500, 'Could not generate a unique transfer number. Please try again.');
}));

router.get('/:id', wrap(async (req, res) => {
  res.json(toApi(await getDraft(req.params.id)));
}));

router.patch('/:id', wrap(async (req, res) => {
  const cur = await getDraft(req.params.id);
  const b = req.body || {};
  const u = {};

  if ('machineName' in b) u.machine_name = str(b.machineName).slice(0, 200);
  if ('sapNo' in b) u.sap_no = str(b.sapNo).slice(0, 100);
  if ('equipmentNo' in b) u.equipment_no = str(b.equipmentNo).slice(0, 100);
  if ('receiverEmail' in b) {
    u.receiver_email = str(b.receiverEmail).toLowerCase().slice(0, 200);
    if (!EMAIL_RE.test(u.receiver_email)) throw httpError(400, 'Enter a valid receiver email');
  }
  if ('sourcePlantId' in b) {
    const p = await getPlant(b.sourcePlantId);
    if (!p) throw httpError(400, 'Select a valid source plant');
    u.source_plant_id = p.id; u.source_plant_name = p.name;
  }
  if ('destinationPlantId' in b) {
    const p = await getPlant(b.destinationPlantId);
    if (!p) throw httpError(400, 'Select a valid destination plant');
    u.destination_plant_id = p.id; u.destination_plant_name = p.name;
  }
  const srcId = u.source_plant_id || cur.source_plant_id;
  const dstId = u.destination_plant_id || cur.destination_plant_id;
  if (srcId && dstId && srcId === dstId) throw httpError(400, 'Source and destination plants must be different');

  if ('machinePhotos' in b) u.machine_photos = cleanPhotos(b.machinePhotos);
  if ('hasElectrical' in b) u.has_electrical = !!b.hasElectrical;
  if ('electricalPhotos' in b) u.electrical_photos = cleanPhotos(b.electricalPhotos);
  if ('electricalChecklist' in b) u.electrical_checklist = cleanChecklist(b.electricalChecklist);
  if ('hasMechanical' in b) u.has_mechanical = !!b.hasMechanical;
  if ('mechanicalPhotos' in b) u.mechanical_photos = cleanPhotos(b.mechanicalPhotos);
  if ('mechanicalChecklist' in b) u.mechanical_checklist = cleanChecklist(b.mechanicalChecklist);
  if ('mechanicalOverallStatus' in b) {
    const s = str(b.mechanicalOverallStatus);
    if (s && !MECHANICAL_STATUS_OPTIONS.includes(s)) throw httpError(400, 'Invalid overall status');
    u.mechanical_overall_status = s;
  }
  if ('missingParameters' in b) u.missing_parameters = str(b.missingParameters).slice(0, 2000);
  if ('missingPhotoUrl' in b) u.missing_photo_url = cleanUrl(b.missingPhotoUrl);
  if ('abnormalities' in b) u.abnormalities = str(b.abnormalities).slice(0, 2000);
  if ('abnormalityPhotoUrl' in b) u.abnormality_photo_url = cleanUrl(b.abnormalityPhotoUrl);

  if (!Object.keys(u).length) return res.json(toApi(cur));
  const { data, error } = await supabase.from('transfers').update(u).eq('id', cur.id).select().single();
  if (error) throw error;
  res.json(toApi(data));
}));

function sendProblem(t) {
  if (!t.machine_name || !t.sap_no || !t.equipment_no) return 'Machine name, SAP number and equipment number are required';
  if (!t.source_plant_id || !t.destination_plant_id) return 'Select the source and destination plants again (a plant may have been removed)';
  if (!EMAIL_RE.test(t.receiver_email)) return 'Enter a valid receiver email';
  const sides = (t.machine_photos || []).slice(0, 4);
  if (sides.length < 4 || sides.some((p) => !p.url)) return 'Photos of all four sides are required';
  if (t.has_electrical && !(t.electrical_photos || []).some((p) => p.url)) return 'Add at least one electrical photo';
  if (t.has_mechanical) {
    if (!(t.mechanical_photos || []).some((p) => p.url)) return 'Add at least one mechanical photo';
    if (!MECHANICAL_STATUS_OPTIONS.includes(t.mechanical_overall_status)) return 'Select the overall mechanical status';
  }
  return '';
}

router.post('/:id/send', wrap(async (req, res) => {
  const cur = await getDraft(req.params.id);
  const problem = sendProblem(cur);
  if (problem) throw httpError(400, problem);
  const { data, error } = await supabase
    .from('transfers')
    .update({ status: 'pending', sent_at: new Date().toISOString() })
    .eq('id', cur.id).select().single();
  if (error) throw error;
  res.json(toApi(data));
}));

module.exports = router;