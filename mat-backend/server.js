// Local development entry point. On Vercel, api/index.js is the entry
// point instead — Vercel calls the exported Express app directly as a
// serverless function and never runs this file.
require('dotenv').config();
const app = require('./src/app');

['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].forEach((key) => {
  if (!process.env[key]) {
    console.error(`${key} is not set. Copy .env.example to .env and set a value.`);
    process.exit(1);
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Machine Asset Transfer API listening on http://localhost:${PORT}`);
});
