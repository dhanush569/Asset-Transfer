require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/plants', require('./routes/plants'));
app.use('/api/transfers', require('./routes/transfers'));
app.use('/api/receiver', require('./routes/receiver'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/uploads', require('./routes/uploads'));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  if (status >= 500) console.error(err);
  const message = err.code === 'LIMIT_FILE_SIZE' ? 'Photo is too large (max 10 MB)' : (err.message || 'Server error');
  res.status(status).json({ error: message });
});

module.exports = app;
module.exports.app = app;
module.exports.default = app;