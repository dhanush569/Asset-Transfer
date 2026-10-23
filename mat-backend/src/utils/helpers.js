const crypto = require('crypto');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

// snake_case row -> camelCase object (top level only; jsonb contents untouched).
// Never exposes the receiver access-code fields.
function toApi(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'access_code_hash' || k === 'access_code_expires') continue;
    out[camel(k)] = v;
  }
  return out;
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const cleanUrl = (u) => (/^https?:\/\//i.test(str(u)) ? str(u).slice(0, 1000) : '');
const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genTransferNo() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return `MAT-${yy}${mm}-${s}`;
}

module.exports = { wrap, httpError, toApi, str, cleanUrl, isUuid, genTransferNo };