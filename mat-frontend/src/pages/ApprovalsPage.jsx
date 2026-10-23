import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

function checklistSummary(checklist) {
  let total = 0, passed = 0;
  (checklist || []).forEach((cat) => cat.items.forEach((i) => { total += 1; if (i.checked) passed += 1; }));
  return { total, passed };
}

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState(null);
  const [plants, setPlants] = useState({});
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const isAdmin = ['Plant Admin', 'Super Admin'].includes(user.role);

  const load = useCallback(async () => {
    try {
      const [pending1, pending2, plantData] = await Promise.all([
        api.get(`/api/transfers?plantId=${user.plantId}&status=pending_stage1`),
        api.get(`/api/transfers?plantId=${user.plantId}&status=pending_stage2`),
        api.get('/api/plants'),
      ]);
      const mine = [...pending1, ...pending2].filter(
        (t) => isAdmin ||
          (t.status === 'pending_stage1' && t.approverStage1Id === user.id) ||
          (t.status === 'pending_stage2' && t.approverStage2Id === user.id)
      );
      setTransfers(mine);
      const plantMap = {};
      plantData.forEach((p) => (plantMap[p.id] = p));
      setPlants(plantMap);
    } catch (err) {
      setError(err.message);
    }
  }, [user, isAdmin]);

  useEffect(() => { load(); }, [load]);

  async function decide(id, decision) {
    setBusyId(id);
    setError('');
    try {
      await api.post(`/api/transfers/${id}/decide`, { decision });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h2>Approvals</h2>
      <div className="crumb">Transfers awaiting your sign-off</div>
      {error && <div className="err-text">{error}</div>}

      {transfers === null && <div className="empty-state">Loading…</div>}
      {transfers?.length === 0 && <div className="empty-state">Nothing awaiting your approval.</div>}

      {transfers?.map((t) => {
        const elec = checklistSummary(t.electricalChecklist);
        const mech = checklistSummary(t.mechanicalChecklist);
        const stageLabel = t.status === 'pending_stage1' ? 'Stage 1 of 2 — Source plant review' : 'Stage 2 of 2 — Destination plant review';
        return (
          <div className={`panel status-bar ${t.status}`} key={t.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <b>{t.machineName}</b>
                <div className="meta mono" style={{ color: 'var(--muted)' }}>
                  SAP {t.sapNo} · {plants[t.sourcePlantId]?.name} → {plants[t.destinationPlantId]?.name}
                </div>
                <div className="meta" style={{ marginTop: 8, color: 'var(--muted)', lineHeight: 1.6 }}>
                  {stageLabel}<br />
                  {t.hasElectrical && <>Electrical checklist: {elec.passed}/{elec.total} passed<br /></>}
                  {t.hasMechanical && <>Mechanical checklist: {mech.passed}/{mech.total} passed<br /></>}
                  {t.missingParameters && <>Missing parameters: {t.missingParameters}<br /></>}
                  {t.abnormalities && <>Abnormalities: {t.abnormalities}<br /></>}
                </div>
              </div>
              <span className={`badge ${t.status}`}>Pending</span>
            </div>
            <div className="btn-row">
              <button className="btn success" disabled={busyId === t.id} onClick={() => decide(t.id, 'approve')}>Approve</button>
              <button className="btn danger" disabled={busyId === t.id} onClick={() => decide(t.id, 'reject')}>Reject</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
