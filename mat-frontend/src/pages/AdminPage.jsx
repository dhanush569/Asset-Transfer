import React, { useCallback, useEffect, useState } from 'react';
import { api, tokens } from '../api/client';
import { Field, Alert, TopBar, Spinner } from '../components/ui';
import TransferReview from '../components/TransferReview';

const KEY = 'admin';
const fmt = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const Badge = ({ s }) => <span className={`badge ${s}`}>{s === 'pending' ? 'Pending' : 'Verified'}</span>;

function Login({ onLogin }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function go(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = await api.adminLogin(pw);
      onLogin(res.token);
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }
  return (
    <div className="container">
      <TopBar title="Admin" subtitle="Sign in" />
      <form className="card" onSubmit={go}>
        <Alert>{err}</Alert>
        <Field label="Admin password" required><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></Field>
        <button className="btn primary full" disabled={busy || !pw}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

function TransferRow({ r, onOpen }) {
  return (
    <button type="button" className="list-row" onClick={() => onOpen(r.id)}>
      <div className="list-main">
        <div className="list-top"><b>{r.transferNo}</b><Badge s={r.status} /></div>
        <div>{r.machineName}</div>
        <div className="muted small">{r.sourcePlantName} → {r.destinationPlantName}</div>
        <div className="muted small">Sent {fmt(r.sentAt)}{r.verifiedAt ? ` · Verified ${fmt(r.verifiedAt)}` : ''}</div>
      </div>
    </button>
  );
}

function Detail({ token, id, onBack, onAuthError }) {
  const [t, setT] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    api.adminTransfer(token, id).then(setT).catch((e) => { if (e.status === 401) onAuthError(); else setErr(e.message); });
  }, [token, id, onAuthError]);
  return (
    <div className="container page">
      <TopBar title={t ? t.transferNo : 'Transfer'} subtitle="Complete record" back={{ label: 'Back', onClick: onBack }} />
      <Alert>{err}</Alert>
      {!t && !err && <div className="center pad"><Spinner /></div>}
      {t && (
        <>
          <div className="card summary">
            <div className="list-top"><b>{t.machineName}</b><Badge s={t.status} /></div>
            <div><span className="muted">Route</span> {t.sourcePlantName} → {t.destinationPlantName}</div>
            <div><span className="muted">Receiver email</span> {t.receiverEmail}</div>
            <div><span className="muted">Sent by provider</span> {fmt(t.sentAt)}</div>
            <div><span className="muted">Receiver verified</span> {t.status === 'verified' ? fmt(t.verifiedAt) : 'Waiting for receiver'}</div>
          </div>
          <TransferReview t={t} review={t.receiverReview || {}} readOnly />
        </>
      )}
    </div>
  );
}

function Dashboard({ token, onAuthError, onOpen }) {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [err, setErr] = useState('');
  useEffect(() => {
    Promise.all([api.adminStats(token), api.adminTransfers(token)])
      .then(([s, list]) => { setStats(s); setRecent(list.slice(0, 5)); })
      .catch((e) => { if (e.status === 401) onAuthError(); else setErr(e.message); });
  }, [token, onAuthError]);
  return (
    <div>
      <Alert>{err}</Alert>
      {!stats && !err && <div className="center pad"><Spinner /></div>}
      {stats && (
        <div className="stats">
          <div className="stat"><div className="stat-n">{stats.total}</div><div className="muted">Total transfers</div></div>
          <div className="stat warn"><div className="stat-n">{stats.pending}</div><div className="muted">Pending</div></div>
          <div className="stat ok"><div className="stat-n">{stats.verified}</div><div className="muted">Verified</div></div>
        </div>
      )}
      <h3 className="section">Recent transfers</h3>
      {stats && recent.length === 0 && <div className="muted">No transfers have been sent yet.</div>}
      {recent.map((r) => <TransferRow key={r.id} r={r} onOpen={onOpen} />)}
    </div>
  );
}

function Transfers({ token, onAuthError, onOpen }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback((search) => {
    setErr('');
    api.adminTransfers(token, search).then(setList).catch((e) => { if (e.status === 401) onAuthError(); else setErr(e.message); });
  }, [token, onAuthError]);
  useEffect(() => { load(''); }, [load]);
  return (
    <div>
      <form className="search" onSubmit={(e) => { e.preventDefault(); load(q.trim()); }}>
        <input placeholder="Search transfers" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn primary">Search</button>
      </form>
      <div className="muted small" style={{ margin: '-8px 0 18px' }}>Search by transfer no., machine, SAP, plant or email.</div>
      <Alert>{err}</Alert>
      {!list && !err && <div className="center pad"><Spinner /></div>}
      {list && list.length === 0 && <div className="muted pad">No transfers found.</div>}
      {list && list.map((r) => <TransferRow key={r.id} r={r} onOpen={onOpen} />)}
    </div>
  );
}

function Plants({ token, onAuthError }) {
  const [plants, setPlants] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const fail = useCallback((e) => { if (e.status === 401) onAuthError(); else setErr(e.message); }, [onAuthError]);
  const load = useCallback(() => { api.listPlants().then(setPlants).catch(fail); }, [fail]);
  useEffect(() => { load(); }, [load]);

  async function add(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await api.addPlant(token, { name, code });
      setName(''); setCode('');
      load();
    } catch (ex) { fail(ex); } finally { setBusy(false); }
  }

  async function remove(p) {
    if (!window.confirm(`Delete plant "${p.name}"? Past transfers keep the plant name in their records.`)) return;
    setErr('');
    try { await api.deletePlant(token, p.id); load(); } catch (ex) { fail(ex); }
  }

  return (
    <div>
      <form className="card" onSubmit={add}>
        <h3 className="no-top">Add plant</h3>
        <Alert>{err}</Alert>
        <Field label="Plant name" required count={name.length} max={80}><input maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Plant code" required hint="Required: a short code, e.g. VNS."><input value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" /></Field>
        <button className="btn primary full" disabled={busy || !name.trim() || !code.trim()}>{busy ? 'Adding…' : 'Add plant'}</button>
      </form>
      <h3 className="section">Plants</h3>
      {!plants && <div className="center pad"><Spinner /></div>}
      {plants && plants.length === 0 && <div className="muted">No plants yet.</div>}
      {plants && plants.map((p) => (
        <div className="list-row static" key={p.id}>
          <div className="list-main"><b>{p.name}</b> <span className="chip">{p.code}</span></div>
          <button className="btn danger small-btn" onClick={() => remove(p)}>Delete</button>
        </div>
      ))}
    </div>
  );
}

function AdminApp({ token, onLogout }) {
  const [tab, setTab] = useState('dashboard');
  const [openId, setOpenId] = useState(null);
  const onAuthError = useCallback(() => onLogout(), [onLogout]);

  if (openId) return <Detail token={token} id={openId} onBack={() => setOpenId(null)} onAuthError={onAuthError} />;

  return (
    <div className="container page">
      <TopBar title="Admin" subtitle={tab === 'dashboard' ? 'Dashboard' : tab === 'transfers' ? 'Transfers' : 'Plants'}
        right={<button className="link" onClick={onLogout}>Sign out</button>} />
      {tab === 'dashboard' && <Dashboard token={token} onAuthError={onAuthError} onOpen={setOpenId} />}
      {tab === 'transfers' && <Transfers token={token} onAuthError={onAuthError} onOpen={setOpenId} />}
      {tab === 'plants' && <Plants token={token} onAuthError={onAuthError} />}
      <nav className="tabs">
        {[['dashboard', 'Dashboard'], ['transfers', 'Transfers'], ['plants', 'Plants']].map(([k, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>
    </div>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState(tokens.get(KEY));
  const logout = useCallback(() => { tokens.clear(KEY); setToken(''); }, []);
  if (!token) return <Login onLogin={(tk) => { tokens.set(KEY, tk); setToken(tk); }} />;
  return <AdminApp token={token} onLogout={logout} />;
}