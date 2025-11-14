import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// PUBLIC_INTERFACE
export function ProtectedRoute() {
  /** Guard route for authenticated users */
  const { loading, user } = useAuth();
  if (loading) return <div className="container" style={{ padding: 24 }}>Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <Outlet />;
}

// PUBLIC_INTERFACE
export function RoleRoute({ allow = [] }) {
  /** Guard route for specific roles (e.g., ['Admin']) */
  const { loading, user, role } = useAuth();
  if (loading) return <div className="container" style={{ padding: 24 }}>Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (allow.length > 0 && !allow.includes(role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
