import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Field, Toggle, Alert, TopBar, Spinner } from '../components/ui';
import PhotoSlot from '../components/PhotoSlot';

const DRAFT_KEY = 'mat_draft_id';
const STEPS = ['Details', 'Photos', 'Electrical', 'Mechanical', 'Submit'];
const STATUS = ['Good', 'Serviceable', 'Worn', 'Damaged', 'Faulty', 'Unsafe', 'Under Maintenance', 'Decommissioned'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BLANK = {
  id: null, transferNo: '', machineName: '', sapNo: '', equipmentNo: '', sourcePlantId: '', destinationPlantId: '',
  receiverEmail: '', machinePhotos: [], hasElectrical: false, electricalPhotos: [], electricalChecklist: [],
  hasMechanical: false, mechanicalPhotos: [], mechanicalChecklist: [], mechanicalOverallStatus: '',
  missingParameters: '', missingPhotoUrl: '', abnormalities: '', abnormalityPhotoUrl: '',
};

const keep = (arr, min = 0) => (arr || []).filter((p, i) => i < min || p.url);

const payload = (t) => ({
  machineName: t.machineName, sapNo: t.sapNo, equipmentNo: t.equipmentNo,
  sourcePlantId: t.sourcePlantId, destinationPlantId: t.destinationPlantId, receiverEmail: t.receiverEmail,
  machinePhotos: keep(t.machinePhotos, 4),
  hasElectrical: t.hasElectrical, electricalPhotos: keep(t.electricalPhotos), electricalChecklist: t.electricalChecklist,
  hasMechanical: t.hasMechanical, mechanicalPhotos: keep(t.mechanicalPhotos), mechanicalChecklist: t.mechanicalChecklist,
  mechanicalOverallStatus: t.mechanicalOverallStatus,
  missingParameters: t.missingParameters, missingPhotoUrl: t.missingPhotoUrl,
  abnormalities: t.abnormalities, abnormalityPhotoUrl: t.abnormalityPhotoUrl,
});

function validate(step, t) {
  if (step === 0) {
    if (!t.machineName.trim() || !t.sapNo.trim() || !t.equipmentNo.trim()) return 'Enter the machine name, SAP number and equipment number.';
    if (!t.sourcePlantId || !t.destinationPlantId) return 'Select both the source and destination plants.';
    if (t.sourcePlantId === t.destinationPlantId) return 'Source and destination plants must be different.';
    if (!EMAIL_RE.test(t.receiverEmail.trim())) return 'Enter a valid receiver email address.';
  }
  if (step === 1) {
    const sides = t.machinePhotos.slice(0, 4);
    if (sides.length < 4 || sides.some((p) => !p.url)) return 'Add photos of all four sides (front, back, left, right).';
  }
  if (step === 2 && t.hasElectrical && !t.electricalPhotos.some((p) => p.url)) return 'Add at least one electrical photo.';
  if (step === 3 && t.hasMechanical) {
    if (!t.mechanicalPhotos.some((p) => p.url)) return 'Add at least one mechanical photo.';
    if (!t.mechanicalOverallStatus) return 'Select the overall mechanical status.';
  }
  return '';
}

function PhotoList({ photos, onChange, fixed = 0, required = 0 }) {
  const set = (i, patch) => onChange(photos.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div>
      {photos.map((p, i) => {
        const isReq = i < Math.max(fixed, required);
        const name = p.label ? `${p.label} side` : `Photo ${i + 1}`;
        return (
          <div className="card" key={i}>
            <Field group label={name} required={isReq}>
              <PhotoSlot label={name} url={p.url} onChange={(url) => set(i, { url })}
                hint={`${isReq ? 'Required' : 'Optional'}: upload a photo (max 10 MB).`} />
            </Field>
            <Field label="Remark" count={p.remark.length} max={500}>
              <input maxLength={500} placeholder="Optional: add a remark" value={p.remark} onChange={(e) => set(i, { remark: e.target.value })} />
            </Field>
            {i >= fixed && (
              <button type="button" className="link danger" onClick={() => onChange(photos.filter((_, j) => j !== i))}>Remove photo</button>
            )}
          </div>
        );
      })}
      <button type="button" className="btn ghost full" onClick={() => onChange([...photos, { label: '', url: '', remark: '' }])}>
        Add {fixed ? 'extra ' : ''}photo
      </button>
    </div>
  );
}

function Checklist({ items, onChange }) {
  const set = (i, patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <div>
      {items.map((it, i) => (
        <div className={'check' + (it.checked ? ' on' : '')} key={i}>
          <button type="button" className={'tick' + (it.checked ? ' on' : '')} aria-pressed={it.checked}
            onClick={() => set(i, { checked: !it.checked })}>{it.checked ? '✓' : ''}</button>
          <div className="check-body">
            <div>{it.text}</div>
            <input className="mini" placeholder="Optional: add a remark" value={it.remark}
              onChange={(e) => set(i, { remark: e.target.value })} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProviderPage() {
  const [plants, setPlants] = useState(null);
  const [t, setT] = useState(BLANK);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [resume, setResume] = useState(null);
  const [done, setDone] = useState(null);

  const set = (patch) => setT((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    let alive = true;
    api.listPlants().then((p) => alive && setPlants(p)).catch((e) => { if (alive) { setPlants([]); setErr(e.message); } });
    const id = localStorage.getItem(DRAFT_KEY);
    if (id) {
      api.getTransfer(id).then((d) => alive && setResume(d)).catch((e) => {
        if (e.status === 404) localStorage.removeItem(DRAFT_KEY);
      });
    }
    return () => { alive = false; };
  }, []);

  async function next() {
    setErr('');
    const problem = validate(step, t);
    if (problem) return setErr(problem);
    setBusy(true);
    try {
      if (step === 0 && !t.id) {
        const created = await api.createTransfer({
          machineName: t.machineName, sapNo: t.sapNo, equipmentNo: t.equipmentNo,
          sourcePlantId: t.sourcePlantId, destinationPlantId: t.destinationPlantId, receiverEmail: t.receiverEmail,
        });
        localStorage.setItem(DRAFT_KEY, created.id);
        setT({ ...BLANK, ...created });
      } else {
        await api.saveTransfer(t.id, payload(t));
      }
      setStep(step + 1);
      window.scrollTo(0, 0);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setErr('');
    for (let s = 0; s <= 3; s++) {
      const problem = validate(s, t);
      if (problem) { setStep(s); return setErr(problem); }
    }
    setBusy(true);
    try {
      await api.saveTransfer(t.id, payload(t));
      const sent = await api.sendTransfer(t.id);
      localStorage.removeItem(DRAFT_KEY);
      setDone(sent);
      window.scrollTo(0, 0);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function startNew() {
    localStorage.removeItem(DRAFT_KEY);
    setT(BLANK); setStep(0); setDone(null); setResume(null); setErr('');
  }

  if (done) {
    return (
      <div className="container">
        <TopBar title="Asset Provider" />
        <div className="card center">
          <div className="big-ok">✓</div>
          <h2>Request sent</h2>
          <p className="muted">Share this transfer number with the receiving plant:</p>
          <div className="tn-big">{done.transferNo}</div>
          <p className="muted">The receiver opens <b>Asset Receiver</b>, enters this number and the email <b>{done.receiverEmail}</b>, and gets an access code by email.</p>
          <button className="btn primary full" onClick={startNew}>Start another transfer</button>
        </div>
      </div>
    );
  }

  if (!plants) return <div className="container"><TopBar title="Asset Provider" /><div className="center pad"><Spinner /></div></div>;

  if (resume && !t.id) {
    return (
      <div className="container">
        <TopBar title="Asset Provider" />
        <div className="card">
          <h3 className="no-top">Unfinished transfer found</h3>
          <p><b>{resume.transferNo}</b> · {resume.machineName}</p>
          <div className="row">
            <button className="btn primary" onClick={() => { setT({ ...BLANK, ...resume }); setStep(0); setResume(null); }}>Resume</button>
            <button className="btn ghost" onClick={startNew}>Discard & start new</button>
          </div>
        </div>
      </div>
    );
  }

  const last = step === STEPS.length - 1;

  return (
    <div className="container page">
      <TopBar title="New transfer" subtitle={t.transferNo ? `No. ${t.transferNo}` : 'Asset Provider'} />
      <div className="steps">
        {STEPS.map((s, i) => (
          <div key={s} className={'step' + (i === step ? ' active' : '') + (i < step ? ' done' : '')}>
            <span className="dot">{i < step ? '✓' : i + 1}</span><span className="step-name">{s}</span>
          </div>
        ))}
      </div>
      <Alert>{err}</Alert>

      {step === 0 && (
        <div>
          {plants.length === 0 && <Alert kind="info">No plants exist yet. Ask the Admin to add plants first.</Alert>}
          <Field label="Machine name" required count={t.machineName.length} max={200}>
            <input maxLength={200} placeholder="e.g. CNC Lathe 04" value={t.machineName} onChange={(e) => set({ machineName: e.target.value })} />
          </Field>
          <div className="grid2">
            <Field label="SAP number" required>
              <input placeholder="e.g. 100234" value={t.sapNo} onChange={(e) => set({ sapNo: e.target.value })} />
            </Field>
            <Field label="Equipment number" required>
              <input placeholder="e.g. EQ-4521" value={t.equipmentNo} onChange={(e) => set({ equipmentNo: e.target.value })} />
            </Field>
          </div>
          <div className="grid2">
            <Field label="Transfer from" required hint="Plant where the machine is now.">
              <select value={t.sourcePlantId} onChange={(e) => set({ sourcePlantId: e.target.value })}>
                <option value="">Select source plant</option>
                {plants.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
            </Field>
            <Field label="Transfer to" required hint="Plant receiving the machine.">
              <select value={t.destinationPlantId} onChange={(e) => set({ destinationPlantId: e.target.value })}>
                <option value="">Select destination plant</option>
                {plants.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
            </Field>
          </div>
          <Field label="Receiver email" required hint="Required: the receiver needs this email and the transfer number to get an access code.">
            <input type="email" inputMode="email" placeholder="name@company.com" value={t.receiverEmail} onChange={(e) => set({ receiverEmail: e.target.value })} />
          </Field>
          <div className="field-hint">A unique transfer number is generated when you continue.</div>
        </div>
      )}

      {step === 1 && (
        <div>
          <p className="muted">Required: upload a photo of each of the four sides. Optional: add extra photos with remarks.</p>
          <PhotoList photos={t.machinePhotos} fixed={4} onChange={(machinePhotos) => set({ machinePhotos })} />
        </div>
      )}

      {step === 2 && (
        <div>
          <div className="card"><Toggle checked={t.hasElectrical} onChange={(hasElectrical) => set({ hasElectrical })} label="This machine has electrical components" /></div>
          {t.hasElectrical && (
            <>
              <h3 className="section">Electrical photos</h3>
              <PhotoList photos={t.electricalPhotos} required={1} onChange={(electricalPhotos) => set({ electricalPhotos })} />
              <h3 className="section">Electrical checklist</h3>
              <Checklist items={t.electricalChecklist} onChange={(electricalChecklist) => set({ electricalChecklist })} />
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="card"><Toggle checked={t.hasMechanical} onChange={(hasMechanical) => set({ hasMechanical })} label="This machine has mechanical components" /></div>
          {t.hasMechanical && (
            <>
              <h3 className="section">Mechanical photos</h3>
              <PhotoList photos={t.mechanicalPhotos} required={1} onChange={(mechanicalPhotos) => set({ mechanicalPhotos })} />
              <h3 className="section">Mechanical checklist</h3>
              <Checklist items={t.mechanicalChecklist} onChange={(mechanicalChecklist) => set({ mechanicalChecklist })} />
              <div className="card">
                <Field label="Overall status">
                  <select value={t.mechanicalOverallStatus} onChange={(e) => set({ mechanicalOverallStatus: e.target.value })}>
                    <option value="">Select status</option>
                    {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
            </>
          )}
        </div>
      )}

      {step === 4 && (
        <div>
          <Field label="Missing parameters" count={t.missingParameters.length} max={2000} caps
            hint="Optional: list anything missing from the machine (manuals, keys, parameter sheets).">
            <textarea maxLength={2000} value={t.missingParameters} onChange={(e) => set({ missingParameters: e.target.value })} />
          </Field>
          <Field group label="Missing parameters photo">
            <PhotoSlot label="Missing parameters" url={t.missingPhotoUrl} onChange={(missingPhotoUrl) => set({ missingPhotoUrl })}
              hint="Optional: upload a photo (max 10 MB)." />
          </Field>
          <Field label="Abnormalities" count={t.abnormalities.length} max={2000} caps
            hint="Optional: describe any abnormal condition you noticed.">
            <textarea maxLength={2000} value={t.abnormalities} onChange={(e) => set({ abnormalities: e.target.value })} />
          </Field>
          <Field group label="Abnormality photo">
            <PhotoSlot label="Abnormality" url={t.abnormalityPhotoUrl} onChange={(abnormalityPhotoUrl) => set({ abnormalityPhotoUrl })}
              hint="Optional: upload a photo (max 10 MB)." />
          </Field>
          <div className="card summary">
            <div><span className="muted">Transfer</span> <b>{t.transferNo}</b></div>
            <div><span className="muted">Machine</span> {t.machineName}</div>
            <div><span className="muted">Receiver email</span> {t.receiverEmail}</div>
            <div><span className="muted">Electrical</span> {t.hasElectrical ? 'Included' : 'No'} · <span className="muted">Mechanical</span> {t.hasMechanical ? 'Included' : 'No'}</div>
          </div>
        </div>
      )}

      <div className="bar">
        <button className="btn ghost" disabled={step === 0 || busy} onClick={() => { setErr(''); setStep(step - 1); window.scrollTo(0, 0); }}>Back</button>
        {last
          ? <button className="btn primary grow" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send request'}</button>
          : <button className="btn primary grow" disabled={busy || (step === 0 && plants.length === 0)} onClick={next}>{busy ? 'Saving…' : 'Next'}</button>}
      </div>
    </div>
  );
}