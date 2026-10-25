import React, { useState } from 'react';
import PhotoSlot from './PhotoSlot';

// Every line the receiver can verify. id -> key stored in receiverReview.
export function reviewItems(t) {
  const items = [{ id: 'machineName' }, { id: 'sapNo' }, { id: 'equipmentNo' }, { id: 'route' }];
  (t.machinePhotos || []).forEach((p, i) => items.push({ id: `mp.${i}`, photo: true }));
  if (t.hasElectrical) {
    (t.electricalPhotos || []).forEach((p, i) => items.push({ id: `ep.${i}`, photo: true }));
    (t.electricalChecklist || []).forEach((c, i) => items.push({ id: `ec.${i}` }));
  }
  if (t.hasMechanical) {
    (t.mechanicalPhotos || []).forEach((p, i) => items.push({ id: `kp.${i}`, photo: true }));
    (t.mechanicalChecklist || []).forEach((c, i) => items.push({ id: `mc.${i}` }));
    items.push({ id: 'mechStatus' });
  }
  items.push({ id: 'missing' });
  if (t.missingPhotoUrl) items.push({ id: 'missingPhoto', photo: true });
  items.push({ id: 'abn' });
  if (t.abnormalityPhotoUrl) items.push({ id: 'abnPhoto', photo: true });
  return items;
}

export function reviewProgress(t, review) {
  const items = reviewItems(t);
  const ticked = items.filter((i) => review[i.id] && review[i.id].checked).length;
  const noPhoto = items.filter((i) => i.photo && !(review[i.id] && review[i.id].photoUrl)).length;
  return { total: items.length, ticked, noPhoto };
}

function Verify({ id, review, onReview, readOnly, photo }) {
  const r = review[id] || {};
  const [open, setOpen] = useState(!!r.remark);

  if (readOnly) {
    return (
      <div className="verify ro">
        <div className={'vstate ' + (r.checked ? 'ok' : 'no')}>{r.checked ? '✓ Verified' : '— Not verified'}</div>
        {r.remark && <div className="vremark">Receiver remark: {r.remark}</div>}
        {photo && r.photoUrl && <PhotoSlot label="Receiver photo" url={r.photoUrl} disabled />}
      </div>
    );
  }
  return (
    <div className="verify">
      <div className="verify-top">
        <button type="button" className={'tick big' + (r.checked ? ' on' : '')} aria-pressed={!!r.checked}
          onClick={() => onReview(id, { checked: !r.checked })}>{r.checked ? '✓' : ''}</button>
        <span className="vlabel">{r.checked ? 'Verified' : 'Tick to verify'}</span>
        <button type="button" className="btn ghost small-btn remark-btn" onClick={() => setOpen(!open)}>
          {open ? 'Hide remark' : r.remark ? 'Edit remark' : 'Add remark'}
        </button>
      </div>
      {open && (
        <input className="mini" maxLength={500} placeholder="Optional: add a remark" value={r.remark || ''}
          onChange={(e) => onReview(id, { remark: e.target.value })} />
      )}
      {photo && (
        <div className="verify-photo">
          <div className="item-label">Your photo against the provider photo</div>
          <PhotoSlot label="Your photo" url={r.photoUrl || ''} onChange={(u) => onReview(id, { photoUrl: u })}
            hint="Optional: take or upload your own photo of this item (max 10 MB)." />
        </div>
      )}
    </div>
  );
}

export default function TransferReview({ t, review = {}, onReview, readOnly }) {
  const showVerify = !readOnly || t.status === 'verified' || Object.keys(review).length > 0;
  const verify = (id, photo) => (showVerify
    ? <Verify id={id} review={review} onReview={onReview} readOnly={readOnly} photo={photo} /> : null);

  // Plain render helpers (not components) so inputs keep focus while typing.
  const row = (id, label, value) => (
    <div className="item" key={id}>
      <div className="item-label">{label}</div>
      <div className="item-val">{value || '—'}</div>
      {verify(id, false)}
    </div>
  );

  const photoItem = (id, label, p) => (
    <div className="item" key={id}>
      <div className="item-label">{label}</div>
      <PhotoSlot label="Provider photo" url={p.url} disabled />
      {p.remark && <div className="muted prov-remark">Provider remark: {p.remark}</div>}
      {verify(id, true)}
    </div>
  );

  const checkItem = (id, c) => (
    <div className="item" key={id}>
      {c.custom && <div className="item-label">Custom check</div>}
      <div className="item-val">{c.text}</div>
      <div className="muted">Provider: {c.checked ? '✓ Checked' : '✗ Not checked'}{c.remark ? ` · ${c.remark}` : ''}</div>
      {verify(id, false)}
    </div>
  );

  const photoLabel = (p, i, noun) => (p.label ? `${p.label} side` : `${noun} photo ${i + 1}`);

  return (
    <div>
      <h3 className="section">Machine details</h3>
      {row('machineName', 'Machine name', t.machineName)}
      {row('sapNo', 'SAP number', t.sapNo)}
      {row('equipmentNo', 'Equipment number', t.equipmentNo)}
      {row('route', 'Transfer route', `${t.sourcePlantName || '—'}  →  ${t.destinationPlantName || '—'}`)}

      <h3 className="section">Machine photos</h3>
      {(t.machinePhotos || []).map((p, i) => photoItem(`mp.${i}`, photoLabel(p, i, 'Machine'), p))}

      {t.hasElectrical && (
        <>
          <h3 className="section">Electrical components</h3>
          {(t.electricalPhotos || []).map((p, i) => photoItem(`ep.${i}`, photoLabel(p, i, 'Electrical'), p))}
          {(t.electricalChecklist || []).map((c, i) => checkItem(`ec.${i}`, c))}
        </>
      )}

      {t.hasMechanical && (
        <>
          <h3 className="section">Mechanical components</h3>
          {(t.mechanicalPhotos || []).map((p, i) => photoItem(`kp.${i}`, photoLabel(p, i, 'Mechanical'), p))}
          {(t.mechanicalChecklist || []).map((c, i) => checkItem(`mc.${i}`, c))}
          {row('mechStatus', 'Overall mechanical status', t.mechanicalOverallStatus)}
        </>
      )}

      <h3 className="section">Missing parameters &amp; abnormalities</h3>
      {row('missing', 'Missing parameters', t.missingParameters || 'None reported')}
      {t.missingPhotoUrl && photoItem('missingPhoto', 'Missing parameters photo', { url: t.missingPhotoUrl })}
      {row('abn', 'Abnormalities', t.abnormalities || 'None reported')}
      {t.abnormalityPhotoUrl && photoItem('abnPhoto', 'Abnormality photo', { url: t.abnormalityPhotoUrl })}
    </div>
  );
}