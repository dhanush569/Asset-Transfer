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

// Photos are shown from their public web address, so the bucket must exist AND be public.
// Checked once per server start: creates it if missing, switches it to public if it is private.
let bucketReady = null;
function ensurePublicBucket(bucket) {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { data, error } = await supabase.storage.getBucket(bucket);
      if (error || !data) {
        const created = await supabase.storage.createBucket(bucket, { public: true });
        if (created.error && !/already exists/i.test(created.error.message || '')) throw created.error;
      } else if (!data.public) {
        const updated = await supabase.storage.updateBucket(bucket, { public: true });
        if (updated.error) throw updated.error;
      }
    })().catch((e) => { bucketReady = null; throw e; });
  }
  return bucketReady;
}

router.post('/photo', upload.single('photo'), wrap(async (req, res) => {
  if (!req.file) throw httpError(400, 'No photo received');
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'photos';
  await ensurePublicBucket(bucket);
  const ext = (req.file.mimetype.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg';
  const d = new Date();
  const path = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, req.file.buffer, { contentType: req.file.mimetype });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  res.status(201).json({ url: data.publicUrl });
}));

module.exports = router;