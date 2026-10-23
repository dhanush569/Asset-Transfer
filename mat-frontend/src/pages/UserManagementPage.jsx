import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';

const ROLES = ['Operator', 'Approver', 'Plant Admin', 'Super Admin'];

export default function UserManagementPage() {
  const [companies, setCompanies] = useState([]);
  const [plants, setPlants] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  const [showPlantForm, setShowPlantForm] = useState(false);
  const [plantForm, setPlantForm] = useState({ companyId: '', name: '', code: '' });

  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({ employeeId: '', name: '', plantId: '', role: 'Operator' });

  const [filterPlant, setFilterPlant] = useState('');
  const [filterRole, setFilterRole] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [c, p, u] = await Promise.all([api.get('/api/companies'), api.get('/api/plants'), api.get('/api/users')]);
      setCompanies(c);
      setPlants(p);
      setUsers(u);
      if (!plantForm.companyId && c.length) setPlantForm((f) => ({ ...f, companyId: c[0].id }));
      if (!userForm.plantId && p.length) setUserForm((f) => ({ ...f, plantId: p[0].id }));
    } catch (err) {
      setError(err.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function addPlant() {
    if (!plantForm.name || !plantForm.code) return;
    setError('');
    try {
      await api.post('/api/plants', plantForm);
      setPlantForm({ ...plantForm, name: '', code: '' });
      setShowPlantForm(false);
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addUser() {
    if (!userForm.employeeId || !userForm.name) return;
    setError('');
    try {
      await api.post('/api/users', userForm);
      setUserForm({ ...userForm, employeeId: '', name: '' });
      setShowUserForm(false);
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(u) {
    setError('');
    try {
      await api.patch(`/api/users/${u.id}`, { active: !u.active });
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  const plantName = (id) => plants.find((p) => p.id === id)?.name || '—';
  const visibleUsers = users.filter((u) => (!filterPlant || u.plantId === filterPlant) && (!filterRole || u.role === filterRole));

  return (
    <div>
      <h2>User Management</h2>
      <div className="crumb">Companies, plants and employee access</div>
      {error && <div className="err-text">{error}</div>}

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Organization</h3>
          <button className="btn ghost" onClick={() => setShowPlantForm((v) => !v)}>+ Add plant</button>
        </div>
        {companies.map((c) => (
          <p key={c.id} style={{ margin: '12px 0 6px' }}><b>{c.name}</b></p>
        ))}
        <p className="meta mono" style={{ margin: 0, color: 'var(--muted)' }}>
          {plants.map((p) => `${p.name} · ${p.code}`).join('  |  ')}
        </p>

        {showPlantForm && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <div className="row">
              <div>
                <label>Company</label>
                <select value={plantForm.companyId} onChange={(e) => setPlantForm({ ...plantForm, companyId: e.target.value })}>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label>Plant name</label>
                <input value={plantForm.name} onChange={(e) => setPlantForm({ ...plantForm, name: e.target.value })} placeholder="e.g. Sriperumbudur" />
              </div>
            </div>
            <div className="row">
              <div>
                <label>Plant code</label>
                <input className="mono" value={plantForm.code} onChange={(e) => setPlantForm({ ...plantForm, code: e.target.value })} placeholder="PC-027" />
              </div>
              <div style={{ alignSelf: 'end' }}>
                <button className="btn" onClick={addPlant} style={{ marginTop: 6 }}>Save plant</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Employees</h3>
          <button className="btn ghost" onClick={() => setShowUserForm((v) => !v)}>+ Add employee</button>
        </div>

        {showUserForm && (
          <div style={{ margin: '14px 0', paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
            <div className="row">
              <div>
                <label>Employee ID</label>
                <input className="mono" value={userForm.employeeId} onChange={(e) => setUserForm({ ...userForm, employeeId: e.target.value })} placeholder="RM-3305" />
              </div>
              <div>
                <label>Name</label>
                <input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} placeholder="Full name" />
              </div>
            </div>
            <div className="row">
              <div>
                <label>Plant</label>
                <select value={userForm.plantId} onChange={(e) => setUserForm({ ...userForm, plantId: e.target.value })}>
                  {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label>Role</label>
                <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <button className="btn" onClick={addUser} style={{ marginTop: 12 }}>Save employee</button>
            <p className="crumb" style={{ marginTop: 8, marginBottom: 0 }}>New employees default to password "password123" — have them change it later.</p>
          </div>
        )}

        <div className="filter-bar">
          <select value={filterPlant} onChange={(e) => setFilterPlant(e.target.value)}>
            <option value="">All plants</option>
            {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Employee ID</th><th>Name</th><th>Plant</th><th>Role</th><th>Status</th></tr>
            </thead>
            <tbody>
              {visibleUsers.map((u) => (
                <tr key={u.id}>
                  <td className="mono">{u.employeeId}</td>
                  <td>{u.name}</td>
                  <td>{plantName(u.plantId)}</td>
                  <td><span className="role-tag">{u.role}</span></td>
                  <td>
                    <div className={`switch${u.active ? ' on' : ''}`} onClick={() => toggleActive(u)} style={{ cursor: 'pointer' }}>
                      <div className="dot" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
