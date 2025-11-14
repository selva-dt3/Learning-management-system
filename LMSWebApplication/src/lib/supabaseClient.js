/**
 * Supabase client setup for the LMS app.
 *
 * Tightened env resolution and diagnostics:
 * - Supports SUPABASE_URL/SUPABASE_KEY and REACT_APP_SUPABASE_URL/REACT_APP_SUPABASE_ANON_KEY (or REACT_APP_SUPABASE_KEY).
 * - NEVER logs secrets and avoids logging objects that could serialize window.process.
 * - Logs one concise line with booleans (url:true/false, key:true/false).
 * - Fast-fail with a short, clear message if missing.
 *
 * Usage:
 * - Call getSupabaseClient() to receive a cached singleton (safe across HMR).
 * - Use isSupabaseConfigured() to gate initial render/spinners in App.
 */

import { createClient } from '@supabase/supabase-js';

// Guard to avoid noisy logs during HMR and prevent re-entrancy
let diagLogged = false;
let initializing = false;

/**
 * Safely read env values without logging objects. We only return strings.
 */
function readEnv(name) {
  try {
    // Access through process.env[name] but never log the object itself.
    return typeof process !== 'undefined' && process?.env ? process.env[name] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve Supabase configuration from supported environment variables.
 * Only presence is returned; do not log values.
 */
function resolveSupabaseEnv() {
  const supabaseUrl =
    readEnv('SUPABASE_URL') ||
    readEnv('REACT_APP_SUPABASE_URL') ||
    '';

  const supabaseKey =
    readEnv('SUPABASE_KEY') ||
    readEnv('REACT_APP_SUPABASE_ANON_KEY') ||
    readEnv('REACT_APP_SUPABASE_KEY') ||
    '';

  // Minimal, safe, one-time diagnostic with booleans only.
  if (!diagLogged) {
    // Explicit boolean conversion; no object logging.
    const hasUrl = Boolean(supabaseUrl);
    const hasKey = Boolean(supabaseKey);
    // Use console.info per request and avoid logging objects to prevent serialization pitfalls.
    console.info('[Supabase] init: url:', hasUrl, 'key:', hasKey);
    diagLogged = true;
  }

  return { supabaseUrl, supabaseKey };
}

/**
 * Quick helper that callers (e.g., App) can use to decide gating while avoiding any network calls.
 * PUBLIC_INTERFACE
 */
export function isSupabaseConfigured() {
  /** Returns true if both URL and Key are present in env. */
  const { supabaseUrl, supabaseKey } = resolveSupabaseEnv();
  return Boolean(supabaseUrl) && Boolean(supabaseKey);
}

/**
 * Create or return a singleton client. No network calls are performed here.
 * Throws a clear error if configuration is missing.
 */
function getOrCreateClient() {
  const { supabaseUrl, supabaseKey } = resolveSupabaseEnv();

  if (!supabaseUrl || !supabaseKey) {
    // Fail fast with clear guidance; do not log secrets.
    throw new Error(
      'Supabase configuration missing. Set SUPABASE_URL/SUPABASE_KEY or REACT_APP_SUPABASE_URL/REACT_APP_SUPABASE_ANON_KEY.'
    );
  }

  // Avoid reference errors if window is not defined (tests/SSR-like tools)
  const g = typeof window !== 'undefined' ? window : {};

  // Ensure singleton and non re-entrant creation in HMR scenarios
  if (g.__supabase_client__) {
    return g.__supabase_client__;
  }
  if (initializing) {
    // If somehow re-entering during init, return the existing or throw a concise message.
    // Prefer returning a temporary client to keep flow unblocked (still no network call).
    return createClient(supabaseUrl, supabaseKey);
  }

  initializing = true;
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

  // Small no-op ping: avoid any network call; simply access a property to ensure client is constructed.
  // This ensures no external I/O that could hang previews.
  void client?.from; // no-op touch

  if (typeof window !== 'undefined') {
    window.__supabase_client__ = client;
  }
  initializing = false;
  return client;
}

// PUBLIC_INTERFACE
export function getSupabaseClient() {
  /**
   * Returns the singleton Supabase client instance (lazy initialized).
   * Returns promptly if env values exist.
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
  try {
    const supabase = getSupabaseClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.user) return { session: null, profile: null, error: null };

    // RLS-aware fetch: profiles table must have policy allowing user_id == auth.uid()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, role, department, email')
      .eq('user_id', session.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') throw profileError; // single() no rows
    // Do not upsert here to avoid side-effects during initialization; let callers manage creation flows.
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
  if (readEnv('REACT_APP_SITE_URL')) return readEnv('REACT_APP_SITE_URL');
  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
  } catch (_) {}
  return '';
}
