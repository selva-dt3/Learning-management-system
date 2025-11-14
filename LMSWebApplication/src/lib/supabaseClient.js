/**
 * Supabase client setup for the LMS app with robust env/runtime resolution.
 *
 * Enhancements:
 * - Supports SUPABASE_*, REACT_APP_*, and VITE_* env prefixes.
 * - Optional runtime fallback via window.__SUPABASE__ = { url, key }.
 * - One-time diagnostic logs booleans only (no secrets).
 * - Exported PUBLIC_INTERFACE: setSupabaseRuntimeConfig({url, key}) to set config before client creation.
 * - Lazy singleton client creation; no module-level initialization in services should pre-throw.
 *
 * Usage:
 * - Call getSupabaseClient() to receive a cached singleton (safe across HMR).
 * - Optionally call setSupabaseRuntimeConfig({ url, key }) prior to first getSupabaseClient().
 * - Use isSupabaseConfigured() to gate UI.
 */

import { createClient } from '@supabase/supabase-js';

let diagLogged = false;
let initializing = false;

// Runtime override storage (applies before env)
let runtimeConfig = { url: '', key: '' };

/**
 * Safely read env values. Returns strings only; never logs the env object.
 */
function readEnv(name) {
  try {
    return typeof process !== 'undefined' && process?.env ? process.env[name] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve Supabase configuration from:
 * 1) Explicit runtime config (set via setSupabaseRuntimeConfig or window.__SUPABASE__)
 * 2) Environment variables (SUPABASE_*, REACT_APP_*, VITE_*)
 * Only booleans are logged once for diagnostics.
 */
function resolveSupabaseConfig() {
  // Window-provided runtime first, then internal runtimeConfig
  let windowUrl, windowKey;
  try {
    if (typeof window !== 'undefined' && window.__SUPABASE__) {
      windowUrl = String(window.__SUPABASE__?.url || '');
      windowKey = String(window.__SUPABASE__?.key || '');
    }
  } catch {
    // ignore
  }

  const url =
    (runtimeConfig.url || windowUrl) ||
    readEnv('SUPABASE_URL') ||
    readEnv('REACT_APP_SUPABASE_URL') ||
    readEnv('VITE_SUPABASE_URL') ||
    '';

  const key =
    (runtimeConfig.key || windowKey) ||
    readEnv('SUPABASE_KEY') ||
    readEnv('REACT_APP_SUPABASE_ANON_KEY') ||
    readEnv('REACT_APP_SUPABASE_KEY') ||
    readEnv('VITE_SUPABASE_ANON_KEY') ||
    readEnv('VITE_SUPABASE_KEY') ||
    '';

  if (!diagLogged) {
    const hasUrl = Boolean(url);
    const hasKey = Boolean(key);
    // Print a single concise boolean-only line
    // Avoid logging objects or secrets.
    console.info('[Supabase] init: url:', hasUrl, 'key:', hasKey);
    diagLogged = true;
  }

  return { url, key };
}

/**
 * PUBLIC_INTERFACE
 */
export function isSupabaseConfigured() {
  /** Returns true if both URL and Key are present from runtime/env. */
  const { url, key } = resolveSupabaseConfig();
  return Boolean(url) && Boolean(key);
}

/**
 * PUBLIC_INTERFACE
 */
export function setSupabaseRuntimeConfig({ url, key } = {}) {
  /**
   * Set Supabase config programmatically before client creation.
   * This is useful when the deployment injects secrets at runtime rather than build time.
   * Secrets are never logged.
   */
  runtimeConfig = {
    url: typeof url === 'string' ? url : runtimeConfig.url,
    key: typeof key === 'string' ? key : runtimeConfig.key,
  };
}

/**
 * Internal: create or return a singleton client.
 */
function getOrCreateClient() {
  const { url, key } = resolveSupabaseConfig();

  if (!url || !key) {
    throw new Error(
      'Supabase configuration missing. Provide SUPABASE_URL/SUPABASE_KEY or REACT_APP_SUPABASE_URL/REACT_APP_SUPABASE_ANON_KEY (or VITE_*), or set window.__SUPABASE__.'
    );
  }

  const g = typeof window !== 'undefined' ? window : {};

  if (g.__supabase_client__) {
    return g.__supabase_client__;
  }
  if (initializing) {
    // return a temporary client to prevent re-entrancy issues
    return createClient(url, key);
  }

  initializing = true;
  const client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: { 'x-client-info': 'LMSWebApp' },
    },
    realtime: { params: { eventsPerSecond: 5 } },
  });

  void client?.from;

  if (typeof window !== 'undefined') {
    g.__supabase_client__ = client;
  }
  initializing = false;
  return client;
}

// PUBLIC_INTERFACE
export function getSupabaseClient() {
  /**
   * Returns the singleton Supabase client instance (lazy initialized).
   */
  return getOrCreateClient();
}

// PUBLIC_INTERFACE
export async function getSessionAndProfile() {
  /**
   * Fetch current session and user profile with role metadata.
   * Returns: { session, profile, error }
   */
  try {
    const supabase = getSupabaseClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.user) return { session: null, profile: null, error: null };

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, role, department, email')
      .eq('user_id', session.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') throw profileError;
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
