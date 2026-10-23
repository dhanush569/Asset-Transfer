import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PhotoSlot from '../components/PhotoSlot';

const SIDES = ['front', 'rear', 'left', 'right'];

export default function NewTransferPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [plants, setPlants] = useState([]);
  const [transfer, setTransfer] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [mechOptions, setMechOptions] = useState([]);

  const [form, setForm] = useState({
    machineName: '', sapNo: '', equipmentNo: '', destinationPlantId: '',
  });

  useEffect(() => {
    api.get('/api/plants').then(setPlants).catch((err) => setError(err.message));
    api.get('/api/checklists/mechanical').then((d) => setMechOptions(d.overallStatusOptions)).catch(() => {});
  }, []);

  function photoAt(list, side) {
    return (list || []).find((p) => p.side === side)?.url;
  }
  function setPhotoAt(field, side) {
    return (url) => {
      const rest = (transfer[field] || []).filter((p) => p.side !== side);
      patchTransfer({ [field]: [...rest, { side, url, remark: '' }] });
    };
  }

  async function createDraft() {
    if (!form.machineName || !form.sapNo || !form.equipmentNo || !form.destinationPlantId) {
      setError('All fields are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await api.post('/api/transfers', {
        machineName: form.machineName,
        sapNo: form.sapNo,
        equipmentNo: form.equipmentNo,
        sourcePlantId: user.plantId,
        destinationPlantId: form.destinationPlantId,
      });
      setTransfer(created);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function patchTransfer(patch) {
    setSaving(true);
    setError('');
    try {
      const updated = await api.patch(`/api/transfers/${transfer.id}`, patch);
      setTransfer(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleChecklistItem(section, categoryIndex, itemIndex, checked) {
    const field = section === 'electrical' ? 'electricalChecklist' : 'mechanicalChecklist';
    // optimistic local update
    const next = structuredClone(transfer);
    next[field][categoryIndex].items[itemIndex].checked = checked;
    setTransfer(next);
    try {
      await api.patch(`/api/transfers/${transfer.id}/checklist`, { section, categoryIndex, itemIndex, checked });
    } catch (err) {
      setError(err.message);
    }
  }

  function next() { setStep((s) => Math.min(4, s + 1)); }
  function back() { setStep((s) => Math.max(1, s - 1)); }

  const machinePhotoCount = (transfer?.machinePhotos || []).length;

  return (
    <div>
      <h2>New Transfer</h2>
      <div className="crumb">Step {step} of 4</div>
      <div className="steps">
        {[1, 2, 3, 4].map((n) => <div key={n} className={`step${n <= step ? ' done' : ''}`} />)}
      </div>

      {error && <div className="err-text">{error}</div>}

      {step === 1 && (
        <div className="panel">
          <h3>Machine details</h3>
          <div className="row">
            <div>
              <label>Machine name</label>
              <input value={form.machineName} onChange={(e) => setForm({ ...form, machineName: e.target.value })} placeholder="e.g. CNC Lathe HL-40" disabled={!!transfer} />
            </div>
            <div>
              <label>SAP No.</label>
              <input className="mono" value={form.sapNo} onChange={(e) => setForm({ ...form, sapNo: e.target.value })} placeholder="400213" disabled={!!transfer} />
            </div>
          </div>
          <div className="row">
            <div>
              <label>Equipment No.</label>
              <input className="mono" value={form.equipmentNo} onChange={(e) => setForm({ ...form, equipmentNo: e.target.value })} placeholder="EQ-11209" disabled={!!transfer} />
            </div>
            <div>
              <label>Destination plant</label>
              <select value={form.destinationPlantId} onChange={(e) => setForm({ ...form, destinationPlantId: e.target.value })} disabled={!!transfer}>
                <option value="">Select…</option>
                {plants.filter((p) => p.id !== user.plantId).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>
          </div>

          {!transfer && (
            <div className="btn-row">
              <button className="btn" onClick={createDraft} disabled={saving}>{saving ? 'Creating…' : 'Create draft & continue'}</button>
            </div>
          )}

          {transfer && (
            <>
              <h3 style={{ marginTop: 20 }}>Photos — all four sides</h3>
              <div className="photo-grid">
                {SIDES.map((side) => (
                  <PhotoSlot key={side} label={side[0].toUpperCase() + side.slice(1)} photo={photoAt(transfer.machinePhotos, side)} onChange={setPhotoAt('machinePhotos', side)} />
                ))}
                <PhotoSlot label="+ Add extra" photo={photoAt(transfer.machinePhotos, 'extra')} onChange={setPhotoAt('machinePhotos', 'extra')} />
              </div>
              <label>Remarks</label>
              <textarea defaultValue={transfer.machineRemarks} onBlur={(e) => patchTransfer({ machineRemarks: e.target.value })} placeholder="Notes on machine condition / photos" />
            </>
          )}
        </div>
      )}

      {step === 2 && transfer && (
        <div className="panel">
          <div className="toggle-row" onClick={() => patchTransfer({ hasElectrical: !transfer.hasElectrical })}>
            <h3 style={{ margin: 0 }}>Has electronic components?</h3>
            <div className={`switch${transfer.hasElectrical ? ' on' : ''}`}><div className="dot" /></div>
          </div>

          {transfer.hasElectrical && (
            <>
              <label>Remarks</label>
              <textarea defaultValue={transfer.electricalRemarks} onBlur={(e) => patchTransfer({ electricalRemarks: e.target.value })} placeholder="Electrical condition notes" />
              <div className="photo-grid">
                <PhotoSlot label="+ Add photo" photo={photoAt(transfer.electricalPhotos, 'general')} onChange={setPhotoAt('electricalPhotos', 'general')} />
                <PhotoSlot label="+ Add extra" photo={photoAt(transfer.electricalPhotos, 'extra')} onChange={setPhotoAt('electricalPhotos', 'extra')} />
              </div>
              {transfer.electricalChecklist.map((cat, ci) => (
                <div className="checklist-cat" key={cat.category}>
                  <h4>{cat.category}</h4>
                  {cat.items.map((item, ii) => (
                    <label className="check-item" key={item.text}>
                      <input type="checkbox" checked={item.checked} onChange={(e) => toggleChecklistItem('electrical', ci, ii, e.target.checked)} />
                      {item.text}
                    </label>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {step === 3 && transfer && (
        <div className="panel">
          <div className="toggle-row" onClick={() => patchTransfer({ hasMechanical: !transfer.hasMechanical })}>
            <h3 style={{ margin: 0 }}>Has mechanical components?</h3>
            <div className={`switch${transfer.hasMechanical ? ' on' : ''}`}><div className="dot" /></div>
          </div>

          {transfer.hasMechanical && (
            <>
              <label>Remarks</label>
              <textarea defaultValue={transfer.mechanicalRemarks} onBlur={(e) => patchTransfer({ mechanicalRemarks: e.target.value })} placeholder="Mechanical condition notes" />
              <div className="photo-grid">
                <PhotoSlot label="+ Add photo" photo={photoAt(transfer.mechanicalPhotos, 'general')} onChange={setPhotoAt('mechanicalPhotos', 'general')} />
                <PhotoSlot label="+ Add extra" photo={photoAt(transfer.mechanicalPhotos, 'extra')} onChange={setPhotoAt('mechanicalPhotos', 'extra')} />
              </div>
              {transfer.mechanicalChecklist.map((cat, ci) => (
                <div className="checklist-cat" key={cat.category}>
                  <h4>{cat.category}</h4>
                  {cat.items.map((item, ii) => (
                    <label className="check-item" key={item.text}>
                      <input type="checkbox" checked={item.checked} onChange={(e) => toggleChecklistItem('mechanical', ci, ii, e.target.checked)} />
                      {item.text}
                    </label>
                  ))}
                </div>
              ))}
              <label>Overall status</label>
              <select value={transfer.mechanicalOverallStatus || ''} onChange={(e) => patchTransfer({ mechanicalOverallStatus: e.target.value })}>
                <option value="">Select…</option>
                {mechOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </>
          )}
        </div>
      )}

      {step === 4 && transfer && (
        <FinalStep transfer={transfer} setTransfer={setTransfer} patchTransfer={patchTransfer} plants={plants} setError={setError} navigate={navigate} />
      )}

      <div className="btn-row">
        {step > 1 && <button className="btn secondary" onClick={back}>Back</button>}
        {step < 4 && transfer && <button className="btn" onClick={next}>Next</button>}
        {step === 1 && !transfer && <span />}
        {step < 4 && machinePhotoCount < 4 && step === 1 && (
          <span className="crumb" style={{ margin: 0, alignSelf: 'center' }}>All 4 side photos required before submitting.</span>
        )}
      </div>
    </div>
  );
}

function FinalStep({ transfer, setTransfer, patchTransfer, plants, setError, navigate }) {
  const [stage1Options, setStage1Options] = useState([]);
  const [stage2Options, setStage2Options] = useState([]);
  const [approverStage1Id, setApproverStage1Id] = useState('');
  const [approverStage2Id, setApproverStage2Id] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/api/users?plantId=${transfer.sourcePlantId}&role=Approver`).then(setStage1Options).catch(() => {});
    api.get(`/api/users?plantId=${transfer.destinationPlantId}&role=Approver`).then(setStage2Options).catch(() => {});
  }, [transfer.sourcePlantId, transfer.destinationPlantId]);

  function photoAt(list, side) { return (list || []).find((p) => p.side === side)?.url; }

  async function handleSubmit() {
    if (!approverStage1Id || !approverStage2Id) {
      setError('Choose an approver for both stages.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/api/transfers/${transfer.id}/submit`, { approverStage1Id, approverStage2Id });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="panel">
        <h3>Missing parameters</h3>
        <textarea defaultValue={transfer.missingParameters} onBlur={(e) => patchTransfer({ missingParameters: e.target.value })} placeholder="List any parameters/documentation not available at time of transfer" />
      </div>
      <div className="panel">
        <h3>Abnormalities</h3>
        <textarea defaultValue={transfer.abnormalities} onBlur={(e) => patchTransfer({ abnormalities: e.target.value })} placeholder="Describe any abnormalities found" />
        <div className="photo-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <PhotoSlot label="+ Add photo (optional)" photo={transfer.abnormalityPhotoUrl} onChange={(url) => patchTransfer({ abnormalityPhotoUrl: url })} />
        </div>
      </div>
      <div className="panel">
        <h3>Route for approval</h3>
        <div className="row">
          <div>
            <label>Stage 1 — source plant approver</label>
            <select value={approverStage1Id} onChange={(e) => setApproverStage1Id(e.target.value)}>
              <option value="">Select…</option>
              {stage1Options.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.employeeId})</option>)}
            </select>
          </div>
          <div>
            <label>Stage 2 — destination plant approver</label>
            <select value={approverStage2Id} onChange={(e) => setApproverStage2Id(e.target.value)}>
              <option value="">Select…</option>
              {stage2Options.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.employeeId})</option>)}
            </select>
          </div>
        </div>
        <p className="crumb" style={{ marginTop: 10, marginBottom: 0 }}>Dropdowns list active users holding the Approver role at the relevant plant.</p>
      </div>
      <div className="btn-row">
        <button className="btn" onClick={handleSubmit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit for approval'}</button>
      </div>
    </>
  );
}
