import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// PUBLIC_INTERFACE
export default function Navbar() {
  /** Simple top navbar showing role and quick links */
  const { role, actions } = useAuth();
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 12, borderBottom: '1px solid var(--border-color)' }}>
      <Link to="/">Home</Link>
      <Link to="/lessons">Lessons</Link>
      <Link to="/quizzes">Quizzes</Link>
      <Link to="/onboarding">Onboarding</Link>
      {role === 'Admin' && <>
        <Link to="/analytics">Analytics</Link>
        <Link to="/admin/invites">User Invitations</Link>
      </>}
      <div style={{ marginLeft: 'auto', display:'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ opacity: 0.7 }}>Role: {role || 'N/A'}</span>
        <Link to="/auth/admin" aria-label="Admin sign-in">Admin Login</Link>
        <Link to="/auth/hr" aria-label="HR sign-in">HR Login</Link>
        <Link to="/auth/employee" aria-label="Employee sign-in">Employee Login</Link>
        <button onClick={() => actions?.signOut?.()}>Sign out</button>
      </div>
    </nav>
  );
}
