//
// Supabase client setup for the LMS app
// Uses environment variables and exposes typed helpers
//

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// PUBLIC_INTERFACE
export function getSupabaseClient() {
  /** Create and return a singleton Supabase client instance.
   * Validates required environment variables and configures with recommended options.
   */
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // We avoid throwing secrets, provide clear message for setup
    // eslint-disable-next-line no-console
    console.error('Supabase env not configured. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.');
  }
  if (!window.__supabase_client__) {
    window.__supabase_client__ = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '', {
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
    });
  }
  return window.__supabase_client__;
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

    if (profileError && profileError.code !== 'PGRST116') throw profileError; // 406 no single result etc.

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
