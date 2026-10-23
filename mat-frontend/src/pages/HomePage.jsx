import React from 'react';
import { Link } from 'react-router-dom';
import { SiteHeader } from '../components/ui';

const Icon = ({ d }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const OPTIONS = [
  { to: '/provider', title: 'Asset Provider', text: 'Start a transfer: machine details, photos and inspection checklists.', d: 'M12 19V5M5 12l7-7 7 7' },
  { to: '/receiver', title: 'Asset Receiver', text: 'Open a transfer with its number and email code, then verify each detail.', d: 'M12 5v14M19 12l-7 7-7-7' },
  { to: '/admin', title: 'Admin', text: 'Dashboard, transfers between plants, and plant management.', d: 'M3 12l9-9 9 9M5 10v10h14V10' },
];

export default function HomePage() {
  return (
    <div className="container">
      <SiteHeader />
      <div className="page-head">
        <h1 className="title">Machine Asset Transfer</h1>
        <div className="subtitle">Choose how you are using the system.</div>
      </div>
      <div className="home-grid">
        {OPTIONS.map((o) => (
          <Link key={o.to} to={o.to} className="home-card">
            <span className="home-icon"><Icon d={o.d} /></span>
            <span>
              <span className="home-title">{o.title}</span>
              <span className="home-text">{o.text}</span>
            </span>
            <span className="home-arrow">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}