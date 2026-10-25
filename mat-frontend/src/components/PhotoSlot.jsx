import React, { useRef, useState } from 'react';
import { api } from '../api/client';

// Shrinks big phone photos before upload (faster on mobile data).
async function compress(file) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    return blob && blob.size < file.size ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file;
  } catch (e) {
    return file;
  }
}

const Icon = ({ children }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const UploadIcon = () => (
  <Icon><path d="M12 13v8" /><path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2" /><path d="m8 17 4-4 4 4" /></Icon>
);
const CameraIcon = () => (
  <Icon><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3.5" /></Icon>
);

export default function PhotoSlot({ label, url, onChange, disabled, hint }) {
  const camRef = useRef(null);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function pick(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    setErr('');
    try {
      const file = await compress(f);
      const res = await api.uploadPhoto(file);
      onChange(res.url);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  if (disabled) {
    return (
      <div className="upload-view">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={label} /></a>
        ) : (
          <div className="upload-none">No photo</div>
        )}
        <div className="upload-cap">{label}</div>
      </div>
    );
  }

  return (
    <div className="upload">
      {url && (
        <div className="upload-preview">
          <img className="upload-thumb" src={url} alt={label} />
          <span>Photo added</span>
        </div>
      )}
      <div className="upload-actions">
        <button type="button" className="upload-box" disabled={busy} onClick={() => camRef.current.click()}>
          <CameraIcon /><span>{url ? 'Retake photo' : 'Take photo'}</span>
        </button>
        <button type="button" className="upload-box" disabled={busy} onClick={() => fileRef.current.click()}>
          <UploadIcon /><span>{url ? 'Replace photo' : 'Upload photo'}</span>
        </button>
      </div>
      {busy && <span className="field-hint">Uploading…</span>}
      {hint && !busy && <span className="field-hint">{hint}</span>}
      {err && <div className="upload-err">{err}</div>}
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
    </div>
  );
}