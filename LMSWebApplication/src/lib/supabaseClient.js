/**
 * Supabase client setup for the LMS app.
 *
 * Robust env resolution:
 * - Preferred: SUPABASE_URL, SUPABASE_KEY
 * - Also supports: REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY (and REACT_APP_SUPABASE_KEY)
 *
 * Security:
 * - NEVER logs secrets. Only logs which variable names were detected (once).
 * - Throws a clear error only after attempting all sources.
 *
 * Usage:
 * - Call getSupabaseClient() anywhere to receive a cached singleton (safe across HMR).
 */

import { createClient } from '@supabase/supabase-js';

// one-time diagnostic gating to avoid noisy logs during HMR
let diagLogged = false;

/**
 * Resolve Supabase configuration from environment variables supported in various environments.
 * We intentionally do not log values, only presence.
 */
function resolveSupabaseEnv() {
  // Try all supported names; do not expose actual values.
  const urlSources = [
    { name: 'SUPABASE_URL', value: process.env.SUPABASE_URL },
    { name: 'REACT_APP_SUPABASE_URL', value: process.env.REACT_APP_SUPABASE_URL },
  ];
  const keySources = [
    { name: 'SUPABASE_KEY', value: process.env.SUPABASE_KEY },
    { name: 'REACT_APP_SUPABASE_ANON_KEY', value: process.env.REACT_APP_SUPABASE_ANON_KEY },
    { name: 'REACT_APP_SUPABASE_KEY', value: process.env.REACT_APP_SUPABASE_KEY },
  ];

  const urlPick = urlSources.find(s => !!s.value);
  const keyPick = keySources.find(s => !!s.value);

  const supabaseUrl = urlPick?.value || '';
  const supabaseKey = keyPick?.value || '';

  // Minimal, safe, one-time diagnostic
  if (!diagLogged) {
    const keyLen = typeof supabaseKey === 'string' ? supabaseKey.length : 0;
    console.warn(
      '[Supabase] Env detection:',
      {
        urlSource: urlPick?.name || 'none',
        keySource: keyPick?.name || 'none',
        keyLength: keyLen > 0 ? keyLen : 0, // length only; no value
      }
    );
    diagLogged = true;
  }

  return { supabaseUrl, supabaseKey };
}

/**
 * Lazily initialized singleton stored on window to avoid multiple clients during HMR.
 * Throws clear error if configuration is missing after attempting all supported env sources.
 */
function getOrCreateClient() {
  const { supabaseUrl, supabaseKey } = resolveSupabaseEnv();

  if (!supabaseUrl || !supabaseKey) {
    // Guidance comment for developers: ensure one of the pairs below is set in .env
    // - SUPABASE_URL and SUPABASE_KEY
    // - REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY
    // Do not hardcode secrets. Values are injected at build/runtime via environment.
    throw new Error(
      'Supabase configuration missing. Please set SUPABASE_URL/SUPABASE_KEY or REACT_APP_SUPABASE_URL/REACT_APP_SUPABASE_ANON_KEY.'
    );
  }

  // Avoid reference errors if window is not defined (tests/SSR-like tools)
  const g = typeof window !== 'undefined' ? window : {};
  if (!g.__supabase_client__) {
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: {
          'x-client-info': 'LMSWebApp',
        },
      },
      realtime: { params: { eventsPerSecond: 5 } },
    });
    if (typeof window !== 'undefined') {
      window.__supabase_client__ = client;
    }
    return client;
  }
  return g.__supabase_client__;
}

// PUBLIC_INTERFACE
export function getSupabaseClient() {
  /**
   * Returns the singleton Supabase client instance (lazy initialized).
   * Never creates multiple instances during HMR.
   */
  return getOrCreateClient();
}

// PUBLIC_INTERFACE
export async function getSessionAndProfile() {
  /**
   * Fetch current session and user profile with role metadata.
   *
   * Returns:
   *   { session, profile, error }
   */
  const supabase = getSupabaseClient();
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.user) return { session: null, profile: null, error: null };

    // RLS-aware fetch: profiles table must have policy allowing user_id == auth.uid()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, role, department, email')
      .eq('user_id', session.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') throw profileError; // single() no rows
    // If no profile row, consider creating minimal profile from auth metadata (best-effort, RLS must allow)
    if (!profile) {
      const { data: up, error: upErr } = await supabase
        .from('profiles')
        .upsert({
          user_id: session.user.id,
          email: session.user.email,
          role: session.user.user_metadata?.role || 'Employee',
          full_name: session.user.user_metadata?.full_name || null
        }, { onConflict: 'user_id' })
        .select('*')
        .single();
      if (!upErr && up) {
        return { session, profile: up, error: null };
      }
    }
    return { session, profile: profile || null, error: null };
  } catch (error) {
    return { session: null, profile: null, error };
  }
}

// PUBLIC_INTERFACE
export function getSiteRedirectUrl() {
  /**
   * Returns site URL for auth redirect (used for email redirect parameters).
   * Falls back to window.location.origin if REACT_APP_SITE_URL is not set.
   */
  if (process.env.REACT_APP_SITE_URL) return process.env.REACT_APP_SITE_URL;
  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
  } catch (_) {}
  return '';
}
