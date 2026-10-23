const jwt = require('jsonwebtoken');

let warned = false;
function secret() {
  if (!process.env.JWT_SECRET && !warned) {
    warned = true;
    console.warn('WARNING: JWT_SECRET is not set in .env — using an insecure development secret.');
  }
  return process.env.JWT_SECRET || 'mat-dev-secret';
}

const sign = (payload, expiresIn) => jwt.sign(payload, secret(), { expiresIn });

function requireScope(scope) {
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
      const decoded = jwt.verify(token, secret());
      if (decoded.scope !== scope) return res.status(403).json({ error: 'Not allowed' });
      req.auth = decoded;
      return next();
    } catch (e) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
  };
}

module.exports = { sign, requireScope };