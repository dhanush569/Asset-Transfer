const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const supabase = require('../db/supabaseClient');
const { wrap, httpError } = require('../utils/helpers');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(/^image\//.test(file.mimetype) ? null : httpError(400, 'Only image files are allowed'), true),
});

router.post('/photo', upload.single('photo'), wrap(async (req, res) => {
  if (!req.file) throw httpError(400, 'No photo received');
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'photos';
  const ext = (req.file.mimetype.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg';
  const d = new Date();
  const path = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
  const doUpload = () => supabase.storage.from(bucket).upload(path, req.file.buffer, { contentType: req.file.mimetype });
  let { error } = await doUpload();
  if (error && /bucket not found/i.test(error.message || '')) {
    // First upload on a fresh project: create the public bucket, then retry once.
    const created = await supabase.storage.createBucket(bucket, { public: true });
    if (created.error && !/already exists/i.test(created.error.message || '')) throw created.error;
    ({ error } = await doUpload());
  }
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  res.status(201).json({ url: data.publicUrl });
}));

module.exports = router;