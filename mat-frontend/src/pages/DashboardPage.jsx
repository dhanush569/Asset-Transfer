import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_LABEL = {
  draft: 'Draft',
  pending_stage1: 'Awaiting source plant approval',
  pending_stage2: 'Awaiting destination plant approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState(null);
  const [plants, setPlants] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [transferData, plantData] = await Promise.all([
          api.get(`/api/transfers?plantId=${user.plantId}`),
          api.get('/api/plants'),
        ]);
        if (cancelled) return;
        setTransfers(transferData);
        const plantMap = {};
        plantData.forEach((p) => (plantMap[p.id] = p));
        setPlants(plantMap);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user.plantId]);

  return (
    <div>
      <h2>Transfers</h2>
      <div className="crumb">All machine transfers involving your plant</div>

      {error && <div className="err-text">{error}</div>}

      <div className="panel">
        {transfers === null && <div className="empty-state">Loading…</div>}
        {transfers?.length === 0 && <div className="empty-state">No transfers yet.</div>}
        {transfers?.map((t) => (
          <div className={`list-item status-bar ${t.status}`} key={t.id}>
            <div>
              <b>{t.machineName}</b>
              <div className="meta mono">
                SAP {t.sapNo} · {plants[t.sourcePlantId]?.name || '—'} → {plants[t.destinationPlantId]?.name || '—'}
              </div>
            </div>
            <span className={`badge ${t.status}`}>{STATUS_LABEL[t.status] || t.status}</span>
          </div>
        ))}
      </div>

      <Link to="/transfers/new" className="btn">+ Start new transfer</Link>
    </div>
  );
}
