import React, { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import '../App.css';

// PUBLIC_INTERFACE
export default function AuthPage() {
  /**
   * Email/password sign-in/up with optional role hint from route or query.
   * Entry routes:
   * - /auth
   * - /auth/:role  (role in ['admin','hr','employee'])
   * - /auth?role=Admin|HR|Employee
   * Role hint changes branding/messaging and default role on sign-up only.
   */
  const { actions, error } = useAuth();
  const params = useParams();
  const [query] = useSearchParams();

  const hintedRole = useMemo(() => {
    const fromParam = String(params?.role || '').toLowerCase();
    const fromQuery = query.get('role');
    const normalize = (r) => {
      if (!r) return null;
      const v = String(r).toLowerCase();
      if (v === 'admin') return 'Admin';
      if (v === 'hr') return 'HR';
      if (v === 'employee') return 'Employee';
      // allow canonical values
      if (['Admin','HR','Employee'].includes(String(r))) return String(r);
      return null;
    };
    return normalize(fromParam) || normalize(fromQuery) || null;
  }, [params, query]);

  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [forgot, setForgot] = useState(false);

  const heading = useMemo(() => {
    if (hintedRole === 'Admin') return 'Admin Portal';
    if (hintedRole === 'HR') return 'HR Portal';
    if (hintedRole === 'Employee') return 'Employee Portal';
    return 'Corporate LMS';
  }, [hintedRole]);

  const subcopy = useMemo(() => {
    if (hintedRole === 'Admin') return 'Manage lessons, quizzes, and analytics.';
    if (hintedRole === 'HR') return 'Assign training, track onboarding and progress.';
    if (hintedRole === 'Employee') return 'Access assigned lessons and quizzes.';
    return 'Sign in or sign up to continue.';
  }, [hintedRole]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setMessage('');
    try {
      if (forgot) {
        await actions.resetPassword(email);
        setMessage('Password reset email sent if the account exists.');
      } else if (mode === 'signin') {
        // Sign-in must not override existing roles. Branding is only visual.
        await actions.signInWithPassword(email, password);
      } else {
        // Sign-up: honor role hint safely via roleOverride
        await actions.signUpWithPassword(email, password, {
          signup_source: 'lms',
          roleOverride: hintedRole || 'Employee',
        });
        setMessage('Check your email to confirm your account.');
      }
    } catch (err) {
      setMessage(err?.message || 'Authentication failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header" style={{ padding: 24 }}>
        <h1>{heading}</h1>
        <p style={{ opacity: 0.8, marginTop: -8, marginBottom: 12 }}>{subcopy}</p>

        {hintedRole && (
          <div role="note" aria-live="polite" style={{ marginBottom: 8, fontSize: 12, opacity: 0.8 }}>
            You are on the {hintedRole} entry page. Existing users keep their current role.
          </div>
        )}

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
          <input type="email" placeholder="email@company.com" value={email} onChange={e=>setEmail(e.target.value)} required />
          {!forgot && <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required={mode==='signin' || mode==='signup'} />}
          <button className="theme-toggle" type="submit" disabled={processing}>
            {processing ? 'Please wait...' : forgot ? 'Reset Password' : (mode==='signin'?'Sign In':'Sign Up')}
          </button>

          <button type="button" onClick={()=>setMode(mode==='signin'?'signup':'signin')} style={{ background:'transparent', border:'1px solid var(--border-color)', padding:8, borderRadius:8 }}>
            {mode==='signin' ? 'Need an account? Sign Up' : 'Have an account? Sign In'}
          </button>

          <button type="button" onClick={()=>setForgot(f=>!f)} style={{ background:'transparent', border:'none', color:'var(--text-secondary)' }}>
            {forgot ? 'Back to Sign In' : 'Forgot password?'}
          </button>

          {(message || error) && <p style={{ color: message?.includes('sent') ? 'green' : 'tomato' }}>{message || error}</p>}
        </form>

        <div style={{ marginTop: 16, fontSize: 14, opacity: 0.9 }}>
          <div>Quick access:</div>
          <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop: 6, flexWrap:'wrap' }}>
            <Link to="/auth/admin">Admin</Link>
            <Link to="/auth/hr">HR</Link>
            <Link to="/auth/employee">Employee</Link>
          </div>
        </div>
      </header>
    </div>
  );
}
