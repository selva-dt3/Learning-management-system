import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { getSupabaseClient, getSessionAndProfile, getSiteRedirectUrl } from '../lib/supabaseClient';
import { toUserMessage } from '../utils/errors';

const AuthContext = createContext(null);

// PUBLIC_INTERFACE
export function useAuth() {
  /** Provides current user session, profile, role flags, and auth methods */
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const supabase = getSupabaseClient();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    const { session: s, profile: p, error } = await getSessionAndProfile();
    if (error) setAuthError(toUserMessage(error));
    setSession(s || null);
    setProfile(p || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      // When auth updates, refetch profile
      refresh();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithPassword = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // After sign-in, ensure a profile exists and sync role if available
    try {
      const role = data?.user?.user_metadata?.role;
      if (data?.user) {
        await supabase.from('profiles').upsert({
          user_id: data.user.id,
          email: email,
          role: role || 'Employee',
          full_name: data.user.user_metadata?.full_name || null
        }, { onConflict: 'user_id' });
      }
    } catch (_) {}
    return data;
  }, [supabase]);

  const signUpWithPassword = useCallback(async (email, password, extra = {}) => {
    const redirectTo = `${getSiteRedirectUrl()}/auth/callback`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: extra, emailRedirectTo: redirectTo },
    });
    if (error) throw error;

    // Ensure profiles row exists with role metadata if provided
    const metadataRole = extra?.role || 'Employee';
    try {
      if (data?.user) {
        await supabase
          .from('profiles')
          .upsert({
            user_id: data.user.id,
            email,
            role: metadataRole,
            full_name: extra?.full_name || null,
          }, { onConflict: 'user_id' });
      }
    } catch (_) { /* RLS may restrict; ignore non-fatal */ }

    return data;
  }, [supabase]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [supabase]);

  const resetPassword = useCallback(async (email) => {
    const redirectTo = `${getSiteRedirectUrl()}/auth/reset`;
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    return data;
  }, [supabase]);

  const updateRole = useCallback(async (userId, newRole) => {
    // Requires RLS allowing Admin/HR; UI should restrict
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('user_id', userId);
    if (error) throw error;
    await refresh();
  }, [supabase, refresh]);

  const value = useMemo(() => {
    const role = profile?.role || null;
    return {
      session,
      user: session?.user || null,
      profile,
      role,
      isAdmin: role === 'Admin',
      isHR: role === 'HR',
      isEmployee: role === 'Employee',
      loading,
      error: authError,
      actions: { signInWithPassword, signUpWithPassword, signOut, refresh, resetPassword, updateRole },
    };
  }, [session, profile, loading, authError, signInWithPassword, signUpWithPassword, signOut, refresh, resetPassword, updateRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
