require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in mat-backend/.env');
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
module.exports = supabase;
module.exports.supabase = supabase;