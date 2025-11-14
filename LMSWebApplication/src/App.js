import React, { useState, useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import AdminDashboard from './pages/dashboards/AdminDashboard';
import HRDashboard from './pages/dashboards/HRDashboard';
import EmployeeDashboard from './pages/dashboards/EmployeeDashboard';
import LessonsList from './pages/lessons/LessonsList';
import LessonEditor from './pages/lessons/LessonEditor';
import LessonViewer from './pages/lessons/LessonViewer';
import QuizzesRoutes from './pages/quizzes';
import Onboarding from './pages/onboarding/Onboarding';
import Analytics from './pages/analytics/Analytics';
import UsersInvitesPage from './pages/admin/UsersInvitesPage';
import { ProtectedRoute, RoleRoute } from './routes/RouteGuards';
import Navbar from './components/Navbar';

// PUBLIC_INTERFACE
function HomeRouter() {
  /** Route user to appropriate dashboard based on role */
  const { user, isAdmin, isHR, isEmployee, loading } = useAuth();
  if (loading) return <div className="container" style={{ padding: 24 }}>Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (isAdmin) return <AdminDashboard />;
  if (isHR) return <HRDashboard />;
  if (isEmployee) return <EmployeeDashboard />;
  return <EmployeeDashboard />;
}

function LayoutWithNavbar() {
  return (
    <div>
      <Navbar />
      <div style={{ paddingTop: 8 }}>
        <Outlet />
      </div>
    </div>
  );
}

// PUBLIC_INTERFACE
function AppShell() {
  /** Root application shell with theme toggle and routing */
  const [theme, setTheme] = useState('light');
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  return (
    <BrowserRouter>
      <button
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
      </button>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/:role" element={<AuthPage />} />
        <Route element={<ProtectedRoute />}>
          {/* Authenticated layout with Navbar */}
          <Route element={<LayoutWithNavbar />}>
            <Route index element={<HomeRouter />} />
            <Route path="/" element={<HomeRouter />} />
            <Route element={<RoleRoute allow={['Admin']} />}>
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/admin/invites" element={<UsersInvitesPage />} />
            </Route>
            <Route element={<RoleRoute allow={['Admin', 'HR', 'Employee']} />}>
              <Route path="/lessons" element={<LessonsList />} />
              <Route path="/lessons/:id" element={<LessonViewer />} />
            </Route>
            <Route element={<RoleRoute allow={['Admin', 'HR']} />}>
              <Route path="/lessons/:id/edit" element={<LessonEditor />} />
              <Route path="/lessons/new" element={<LessonEditor />} />
            </Route>
            <Route element={<RoleRoute allow={['Admin', 'HR', 'Employee']} />}>
              <Route path="/quizzes/*" element={<QuizzesRoutes />} />
              <Route path="/onboarding" element={<Onboarding />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

// PUBLIC_INTERFACE
function App() {
  /** Wrap AppShell with AuthProvider for auth state */
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

export default App;
