/**
 * Supabase client setup for the LMS app.
 * Resolves environment variables from both generic and CRA-prefixed names.
 * - Preferred: SUPABASE_URL, SUPABASE_KEY
 * - Fallbacks: REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY
 * No secrets are logged. A single clear error is thrown if configuration is missing.
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Resolve Supabase configuration from environment variables supported in various environments.
 * We intentionally do not log values, only presence.
 */
function resolveSupabaseEnv() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.REACT_APP_SUPABASE_URL ||
    '';

  const supabaseKey =
    process.env.SUPABASE_KEY ||
    process.env.REACT_APP_SUPABASE_ANON_KEY ||
    '';

  return { supabaseUrl, supabaseKey };
}

/**
 * Lazily initialized singleton stored on window to avoid multiple clients during HMR.
 */
function getOrCreateClient() {
  const { supabaseUrl, supabaseKey } = resolveSupabaseEnv();

  if (!supabaseUrl || !supabaseKey) {
    // Throw a single informative error without exposing any values
    throw new Error(
      'Supabase configuration missing. Please set SUPABASE_URL/SUPABASE_KEY or REACT_APP_SUPABASE_URL/REACT_APP_SUPABASE_ANON_KEY.'
    );
  }

  if (!window.__supabase_client__) {
    window.__supabase_client__ = createClient(supabaseUrl, supabaseKey, {
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
  }
  return window.__supabase_client__;
}

// PUBLIC_INTERFACE
export function getSupabaseClient() {
  /** Returns the singleton Supabase client instance (lazy initialized). */
  return getOrCreateClient();
}

// PUBLIC_INTERFACE
export async function getSessionAndProfile() {
  /** Fetch current session and user profile with role metadata.
   * Returns { session, profile, error }
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
  /** Returns site URL for auth redirect */
  return process.env.REACT_APP_SITE_URL || window.location.origin;
}
