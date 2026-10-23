import React, { useEffect, useRef, useState } from 'react';
import { api, tokens } from '../api/client';
import { Field, Alert, TopBar, Spinner } from '../components/ui';
import TransferReview, { reviewProgress } from '../components/TransferReview';

const KEY = 'receiver';

export default function ReceiverPage() {
  const [stage, setStage] = useState(tokens.get(KEY) ? 'loading' : 'access');
  const [form, setForm] = useState({ transferNo: '', email: '', code: '' });
  const [info, setInfo] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [t, setT] = useState(null);
  const [review, setReview] = useState({});
  const [saveState, setSaveState] = useState('');
  const dirty = useRef(false);

  const f = (patch) => setForm((p) => ({ ...p, ...patch }));

  function load(token) {
    return api.receiverTransfer(token).then((d) => {
      setT(d);
      setReview(d.receiverReview || {});
      dirty.current = false;
      setStage('review');
    });
  }

  useEffect(() => {
    const token = tokens.get(KEY);
    if (token) load(token).catch(() => { tokens.clear(KEY); setStage('access'); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save remarks/ticks/photos shortly after each change.
  useEffect(() => {
    if (!dirty.current || !t || t.status === 'verified') return undefined;
    setSaveState('Saving…');
    const h = setTimeout(async () => {
      try {
        await api.saveReview(tokens.get(KEY), review);
        dirty.current = false;
        setSaveState('All changes saved');
      } catch (e) {
        setSaveState('Not saved: ' + e.message);
      }
    }, 1200);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [review]);

  const onReview = (id, patch) => {
    dirty.current = true;
    setReview((r) => ({ ...r, [id]: { ...(r[id] || {}), ...patch } }));
  };

  async function requestCode(e) {
    e.preventDefault();
    setErr(''); setInfo(''); setBusy(true);
    try {
      const res = await api.requestCode({ transferNo: form.transferNo, email: form.email });
      setInfo(res.devMode
        ? 'Email is not configured on the server yet — the code was printed in the backend terminal.'
        : `A 6-digit code was sent to ${form.email.trim()}. It is valid for 15 minutes.`);
      setStage('code');
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }

  async function verify(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = await api.verifyCode(form);
      tokens.set(KEY, res.token);
      await load(res.token);
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }

  async function submit() {
    const p = reviewProgress(t, review);
    const missing = p.total - p.ticked;
    let msg = 'Submit your verification? You cannot change it afterwards.';
    if (missing > 0 || p.noPhoto > 0) {
      msg = `${missing} item(s) are not ticked and ${p.noPhoto} receiver photo(s) are missing.\n\nSubmit anyway? You cannot change it afterwards.`;
    }
    if (!window.confirm(msg)) return;
    setErr(''); setBusy(true);
    try {
      const res = await api.submitReview(tokens.get(KEY), review);
      dirty.current = false;
      setT(res);
      setReview(res.receiverReview || {});
      window.scrollTo(0, 0);
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }

  function exit() {
    tokens.clear(KEY);
    setT(null); setReview({}); setForm({ transferNo: '', email: '', code: '' });
    setErr(''); setInfo(''); setStage('access');
  }

  if (stage === 'loading') return <div className="container"><TopBar title="Asset Receiver" /><div className="center pad"><Spinner /></div></div>;

  if (stage === 'access') {
    return (
      <div className="container">
        <TopBar title="Asset Receiver" subtitle="Open a transfer" />
        <form className="card" onSubmit={requestCode}>
          <Alert>{err}</Alert>
          <Field label="Transfer number" required><input value={form.transferNo} autoCapitalize="characters" placeholder="MAT-2610-AB3K"
            onChange={(e) => f({ transferNo: e.target.value })} /></Field>
          <Field label="Email" required hint="Required: the email the provider entered for this transfer.">
            <input type="email" inputMode="email" value={form.email} onChange={(e) => f({ email: e.target.value })} /></Field>
          <button className="btn primary full" disabled={busy || !form.transferNo.trim() || !form.email.trim()}>
            {busy ? 'Sending…' : 'Email me an access code'}</button>
        </form>
      </div>
    );
  }

  if (stage === 'code') {
    return (
      <div className="container">
        <TopBar title="Asset Receiver" subtitle={form.transferNo.toUpperCase()} back={{ label: 'Back', onClick: () => { setErr(''); setStage('access'); } }} />
        <form className="card" onSubmit={verify}>
          <Alert kind="info">{info}</Alert>
          <Alert>{err}</Alert>
          <Field label="6-digit access code" required hint="Required: enter the code we emailed you."><input className="code-input" inputMode="numeric" maxLength={6} value={form.code}
            onChange={(e) => f({ code: e.target.value.replace(/\D/g, '') })} autoFocus /></Field>
          <button className="btn primary full" disabled={busy || form.code.length !== 6}>{busy ? 'Checking…' : 'Open transfer'}</button>
          <button type="button" className="link" onClick={requestCode} disabled={busy}>Send a new code</button>
        </form>
      </div>
    );
  }

  const readOnly = t.status === 'verified';
  const p = reviewProgress(t, review);

  return (
    <div className="container page">
      <TopBar title={t.transferNo} subtitle="Receiver verification" right={<button className="link" onClick={exit}>Exit</button>} />
      {readOnly ? (
        <Alert kind="success">Verification submitted. Thank you — this transfer is complete.</Alert>
      ) : (
        <div className="progress-card">
          <div className="progress-top"><b>{p.ticked}</b> of {p.total} verified <span className="muted small">{saveState}</span></div>
          <div className="progress"><div style={{ width: `${(p.ticked / p.total) * 100}%` }} /></div>
          <div className="muted small">Tick each detail to confirm it matches. Add a remark if needed, and add your own photo against each provider photo.</div>
        </div>
      )}
      <Alert>{err}</Alert>
      <TransferReview t={t} review={review} onReview={onReview} readOnly={readOnly} />
      {!readOnly && (
        <div className="bar">
          <button className="btn primary grow" disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit verification'}</button>
        </div>
      )}
    </div>
  );
}