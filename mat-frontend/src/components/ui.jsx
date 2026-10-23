import React from 'react';
import { Link, NavLink } from 'react-router-dom';

// Label above, optional counter + hint below (same order as the reference form).
export function Field({ label, hint, required, count, max, caps, group, children }) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className="field">
      <span className="field-label">{label}{required && <span className="req"> *</span>}</span>
      {children}
      {max ? <span className={'field-count' + (caps ? ' caps' : '')}>{count || 0} / {max} characters</span> : null}
      {hint && <span className="field-hint">{hint}</span>}
    </Tag>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="track"><span className="thumb" /></span>
      <span className="toggle-label">{label}</span>
    </label>
  );
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  return <div className={`alert ${kind}`}>{children}</div>;
}

export function Spinner() {
  return <span className="spinner" aria-label="Loading" />;
}

const NAV = [['/provider', 'Provider'], ['/receiver', 'Receiver'], ['/admin', 'Admin']];

export function SiteHeader({ right }) {
  return (
    <header className="site-header">
      <div className="site-header-in">
        <Link to="/" className="brand"><b>MAT</b><span>ASSET TRANSFER</span></Link>
        <nav className="nav">
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>
          ))}
        </nav>
        {right && <div className="hdr-right">{right}</div>}
      </div>
    </header>
  );
}

export function TopBar({ title, subtitle, right, back }) {
  return (
    <>
      <SiteHeader right={right} />
      <div className="page-head">
        {back && <button type="button" className="back" onClick={back.onClick}>← {back.label}</button>}
        <h1 className="title">{title}</h1>
        {subtitle && <div className="subtitle">{subtitle}</div>}
      </div>
    </>
  );
}