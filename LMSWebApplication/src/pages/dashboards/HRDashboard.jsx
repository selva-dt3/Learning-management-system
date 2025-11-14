import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// PUBLIC_INTERFACE
export default function HRDashboard() {
  const { profile, actions } = useAuth();
  return (
    <div className="container" style={{ padding: 24 }}>
      <h2>HR Dashboard</h2>
      <p>Welcome, {profile?.full_name || 'HR'}.</p>
      <nav style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop: 12 }}>
        <Link to="/lessons">Assigned Lessons</Link>
        <Link to="/analytics">Progress & Analytics</Link>
        <Link to="/onboarding">Onboarding</Link>
      </nav>
      <div style={{ marginTop: 24 }}>
        <button onClick={actions.signOut}>Sign out</button>
      </div>
    </div>
  );
}
