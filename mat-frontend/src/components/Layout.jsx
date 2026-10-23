import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="brand">
          MAT <span>{user?.employeeId}</span>
        </div>
        <NavLink to="/dashboard" className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>
          Dashboard
        </NavLink>
        <NavLink to="/transfers/new" className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>
          New Transfer
        </NavLink>
        <NavLink to="/approvals" className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>
          Approvals
        </NavLink>
        {['Plant Admin', 'Super Admin'].includes(user?.role) && (
          <NavLink to="/users" className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>
            User Management
          </NavLink>
        )}
        <div className="navfoot">{user?.name}<br />{user?.role}</div>
        <button className="signout" onClick={logout}>Sign out</button>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
