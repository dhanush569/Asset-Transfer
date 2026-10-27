// Builds the "verification report" PDF that is emailed to the provider after the receiver submits.
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { LOGO_JPG_BASE64, LOGO_RATIO } = require('./logoData');

const PAGE = [595.28, 841.89];
const M = 40;
const CONTENT_W = PAGE[0] - M * 2;
const INK = rgb(0, 0, 0);
const MUTED = rgb(0.35, 0.35, 0.35);
const LINE = rgb(0.91, 0.9, 0.86);
const AMBER = rgb(0.94, 0.7, 0.11);
const OK = rgb(0.12, 0.48, 0.27);
const WARN = rgb(0.7, 0.15, 0.12);

const MAX_IMAGES = 16;            // keeps the PDF small and the request fast
const MAX_BYTES = 6 * 1024 * 1024;

// Standard PDF fonts only support Latin characters; anything else becomes "?".
const clean = (s) => String(s == null ? '' : s)
  .replace(/→/g, '->').replace(/[✓✔]/g, 'v').replace(/[✗✘]/g, 'x')
  .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u2026/g, '...')
  .replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014\u2022]/g, '?');

// One row per thing the receiver verified (same ids as the website's review screen).
function reviewRows(t, review) {
  const r = review || {};
  const rows = [];
  const add = (id, label, o = {}) => rows.push({ id, label, ...o, review: r[id] || {} });
  const sec = (title) => rows.push({ section: title });
  sec('Machine details');
  add('machineName', 'Machine name', { value: t.machine_name });
  add('sapNo', 'SAP number', { value: t.sap_no });
  add('equipmentNo', 'Equipment number', { value: t.equipment_no });
  add('route', 'Transfer route', { value: `${t.source_plant_name} -> ${t.destination_plant_name}` });
  sec('Machine photos');
  (t.machine_photos || []).forEach((p, i) => add(`mp.${i}`, p.label ? `${p.label} side` : `Machine photo ${i + 1}`, { photo: p.url, note: p.remark }));
  const checks = (prefix, kind, list) => (list || []).forEach((c, i) => add(`${prefix}.${i}`, `${kind} check${c.custom ? ' (custom)' : ''}`, {
    value: c.text, note: `Provider: ${c.checked ? 'checked' : 'not checked'}${c.remark ? ` - ${c.remark}` : ''}`,
  }));
  if (t.has_electrical) {
    sec('Electrical components');
    (t.electrical_photos || []).forEach((p, i) => add(`ep.${i}`, `Electrical photo ${i + 1}`, { photo: p.url, note: p.remark }));
    checks('ec', 'Electrical', t.electrical_checklist);
  }
  if (t.has_mechanical) {
    sec('Mechanical components');
    (t.mechanical_photos || []).forEach((p, i) => add(`kp.${i}`, `Mechanical photo ${i + 1}`, { photo: p.url, note: p.remark }));
    checks('mc', 'Mechanical', t.mechanical_checklist);
    add('mechStatus', 'Overall mechanical status', { value: t.mechanical_overall_status });
  }
  sec('Missing parameters and abnormalities');
  add('missing', 'Missing parameters', { value: t.missing_parameters || 'None reported' });
  if (t.missing_photo_url) add('missingPhoto', 'Missing parameters photo', { photo: t.missing_photo_url });
  add('abn', 'Abnormalities', { value: t.abnormalities || 'None reported' });
  if (t.abnormality_photo_url) add('abnPhoto', 'Abnormality photo', { photo: t.abnormality_photo_url });
  return rows;
}

async function fetchBytes(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (e) {
    return null;
  }
}

async function embedImage(doc, buf) {
  try {
    if (buf[0] === 0xff && buf[1] === 0xd8) return await doc.embedJpg(buf);
    if (buf[0] === 0x89 && buf[1] === 0x50) return await doc.embedPng(buf);
  } catch (e) { /* unsupported image: shown as a link instead */ }
  return null;
}

async function buildReport(t, review) {
  const rows = reviewRows(t, review);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Receiver photos first (they are the new information), then provider photos, up to the budget.
  const jobs = [];
  rows.forEach((x) => { if (x.review && x.review.photoUrl) jobs.push(x.review.photoUrl); });
  rows.forEach((x) => { if (x.photo) jobs.push(x.photo); });
  const urls = [...new Set(jobs)].slice(0, MAX_IMAGES);
  const bytes = await Promise.all(urls.map(fetchBytes));
  const images = new Map();
  let total = 0;
  for (let i = 0; i < urls.length; i++) {
    if (!bytes[i] || total + bytes[i].length > MAX_BYTES) continue;
    const img = await embedImage(doc, bytes[i]);
    if (img) { images.set(urls[i], img); total += bytes[i].length; }
  }

  let page = doc.addPage(PAGE);
  let y = PAGE[1] - M;
  const ensure = (h) => { if (y - h < M + 24) { page = doc.addPage(PAGE); y = PAGE[1] - M; } };
  const wrap = (text, f, size, maxW) => {
    const out = [];
    String(clean(text)).split(/\r?\n/).forEach((para) => {
      let line = '';
      para.split(/\s+/).filter(Boolean).forEach((word) => {
        let w = word;
        while (f.widthOfTextAtSize(w, size) > maxW) {   // very long word: split it
          let k = w.length;
          while (k > 1 && f.widthOfTextAtSize(w.slice(0, k), size) > maxW) k--;
          if (line) { out.push(line); line = ''; }
          out.push(w.slice(0, k)); w = w.slice(k);
        }
        const test = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(test, size) <= maxW) line = test;
        else { out.push(line); line = w; }
      });
      out.push(line);
    });
    return out;
  };
  const text = (s, { f = font, size = 10, color = INK, x = M, maxW = CONTENT_W, gap = 3 } = {}) => {
    wrap(s, f, size, maxW).forEach((ln) => {
      ensure(size + gap);
      y -= size;
      page.drawText(ln, { x, y, size, font: f, color });
      y -= gap;
    });
  };

  // Header: logo + title
  try {
    const logo = await doc.embedJpg(Buffer.from(LOGO_JPG_BASE64, 'base64'));
    const lh = 44;
    page.drawImage(logo, { x: M, y: y - lh, width: lh * LOGO_RATIO, height: lh });
  } catch (e) { page.drawText('RANE', { x: M, y: y - 30, size: 24, font: bold, color: INK }); }
  page.drawText('VERIFICATION REPORT', { x: PAGE[0] - M - bold.widthOfTextAtSize('VERIFICATION REPORT', 13), y: y - 18, size: 13, font: bold, color: INK });
  const tn = clean(t.transfer_no);
  page.drawText(tn, { x: PAGE[0] - M - font.widthOfTextAtSize(tn, 11), y: y - 36, size: 11, font, color: MUTED });
  y -= 56;
  page.drawRectangle({ x: M, y, width: CONTENT_W, height: 2.5, color: AMBER });
  y -= 18;

  const ticked = rows.filter((x) => x.id && x.review.checked).length;
  const totalItems = rows.filter((x) => x.id).length;
  [['Machine', t.machine_name], ['Route', `${t.source_plant_name} -> ${t.destination_plant_name}`],
    ['Provider email', t.provider_email], ['Receiver email', t.receiver_email],
    ['Sent', t.sent_at ? new Date(t.sent_at).toUTCString() : '-'], ['Verified', t.verified_at ? new Date(t.verified_at).toUTCString() : '-'],
    ['Result', `${ticked} of ${totalItems} items verified`]].forEach(([k, v]) => {
    ensure(16);
    page.drawText(clean(k).toUpperCase(), { x: M, y: y - 9, size: 8, font: bold, color: MUTED });
    page.drawText(clean(v), { x: M + 110, y: y - 10, size: 10, font: k === 'Result' ? bold : font, color: INK });
    y -= 16;
  });
  y -= 6;

  const IMG_W = 240;
  const IMG_H = 170;
  const draw = (img, x, label) => {
    const s = Math.min(IMG_W / img.width, IMG_H / img.height, 1);
    const w = img.width * s;
    const h = img.height * s;
    page.drawText(label, { x, y: y - 8, size: 7.5, font: bold, color: MUTED });
    page.drawImage(img, { x, y: y - 14 - h, width: w, height: h });
    return h + 16;
  };

  for (const row of rows) {
    if (row.section) {
      ensure(40);
      y -= 12;
      page.drawText(clean(row.section).toUpperCase(), { x: M, y: y - 9, size: 9, font: bold, color: MUTED });
      y -= 14;
      page.drawLine({ start: { x: M, y }, end: { x: M + CONTENT_W, y }, thickness: 0.7, color: LINE });
      y -= 8;
      continue;
    }
    const rv = row.review || {};
    const pImg = row.photo ? images.get(row.photo) : null;
    const rImg = rv.photoUrl ? images.get(rv.photoUrl) : null;
    ensure(70 + (pImg || rImg ? IMG_H : 0));
    text(row.label.toUpperCase(), { f: bold, size: 7.5, color: MUTED, gap: 2 });
    if (row.value) text(row.value, { size: 10 });
    if (row.note) text(row.note, { size: 9, color: MUTED });
    if (row.photo || rv.photoUrl) {
      let h = 0;
      if (pImg) h = Math.max(h, draw(pImg, M, 'PROVIDER PHOTO'));
      if (rImg) h = Math.max(h, draw(rImg, M + IMG_W + 20, 'RECEIVER PHOTO'));
      y -= h + 4;
      if (row.photo && !pImg) text(`Provider photo (link): ${row.photo}`, { size: 7.5, color: MUTED });
      if (rv.photoUrl && !rImg) text(`Receiver photo (link): ${rv.photoUrl}`, { size: 7.5, color: MUTED });
    }
    text(rv.checked ? 'VERIFIED' : 'NOT VERIFIED', { f: bold, size: 9, color: rv.checked ? OK : WARN, gap: 2 });
    if (rv.remark) text(`Receiver remark: ${rv.remark}`, { size: 9.5 });
    y -= 6;
    ensure(4);
    page.drawLine({ start: { x: M, y }, end: { x: M + CONTENT_W, y }, thickness: 0.4, color: LINE });
    y -= 6;
  }

  doc.getPages().forEach((p, i, all) => {
    p.drawText(`RANE  |  ${clean(t.transfer_no)}  |  page ${i + 1} of ${all.length}`, { x: M, y: 22, size: 8, font, color: MUTED });
  });
  return Buffer.from(await doc.save());
}

module.exports = { buildReport, reviewRows };