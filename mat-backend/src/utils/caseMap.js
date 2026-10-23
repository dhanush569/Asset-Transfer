// Postgres columns are snake_case; the API (and jsonb blob contents, which
// are already camelCase and must NOT be touched) is camelCase. These
// converters are deliberately shallow — only top-level object keys are
// renamed, so nested jsonb values (checklist items, photo arrays, decision
// objects) pass through untouched.

function toCamel(row) {
  if (!row) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camelKey] = value;
  }
  return out;
}

function toSnake(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    out[snakeKey] = value;
  }
  return out;
}

module.exports = { toCamel, toSnake };
