import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import '../App.css';

// PUBLIC_INTERFACE
export default function AuthPage() {
  /** Simple email/password sign-in/up */
  const { actions, error } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setMessage('');
    try {
      if (mode === 'signin') {
        await actions.signInWithPassword(email, password);
      } else {
        await actions.signUpWithPassword(email, password, { signup_source: 'lms' });
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
        <h1>Corporate LMS</h1>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
          <input type="email" placeholder="email@company.com" value={email} onChange={e=>setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
          <button className="theme-toggle" type="submit" disabled={processing}>{processing ? 'Please wait...' : (mode==='signin'?'Sign In':'Sign Up')}</button>
          <button type="button" onClick={()=>setMode(mode==='signin'?'signup':'signin')} style={{ background:'transparent', border:'1px solid var(--border-color)', padding:8, borderRadius:8 }}>
            {mode==='signin' ? 'Need an account? Sign Up' : 'Have an account? Sign In'}
          </button>
          {(message || error) && <p style={{ color: 'tomato' }}>{message || error}</p>}
        </form>
      </header>
    </div>
  );
}
