import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { setSupabaseRuntimeConfig } from './lib/supabaseClient';

// Apply runtime config from window.__SUPABASE__ if present, before any client creation.
// This avoids logging secrets and ensures environments that inject secrets at runtime work.
try {
  if (typeof window !== 'undefined' && window.__SUPABASE__) {
    const url = typeof window.__SUPABASE__.url === 'string' ? window.__SUPABASE__.url : '';
    const key = typeof window.__SUPABASE__.key === 'string' ? window.__SUPABASE__.key : '';
    if (url && key) {
      setSupabaseRuntimeConfig({ url, key });
    }
  }
} catch (_) {
  // ignore; safe fallback to env-based resolution
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
