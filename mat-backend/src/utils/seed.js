// Adds starter plants (safe to run repeatedly). Admin can add/delete plants in the app.
require('dotenv').config();
const supabase = require('../db/supabaseClient');

(async () => {
  const plants = [
    { name: 'Varanavasi', code: 'VNS' },
    { name: 'Pondicherry', code: 'PDY' },
    { name: 'Chennai', code: 'CHN' },
  ];
  const { error } = await supabase.from('plants').upsert(plants, { onConflict: 'name' });
  if (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  }
  console.log('Seeded plants:', plants.map((p) => `${p.name} (${p.code})`).join(', '));
})();