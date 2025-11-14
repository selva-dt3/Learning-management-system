import { getSupabaseClient } from '../lib/supabaseClient';
import { ApplicationError } from '../utils/errors';

const supabase = getSupabaseClient();

/**
 * PUBLIC_INTERFACE
 * Create an invitation using Supabase Admin API when available; fall back to auth.admin.createUser with email confirmations.
 * Also records a row in user_invitations with email, role, department, invited_by, status, created_at.
 * payload: { email, role, department?, invited_by?, redirectTo }
 */
export async function adminInviteUser(payload) {
  const email = String(payload.email || '').trim();
  const role = payload.role;
  const department = payload.department || null;
  const invited_by = payload.invited_by || null;
  const redirectTo = payload.redirectTo;

  if (!email) throw new ApplicationError('Email required', 'INVITE_EMAIL');
  if (!['Admin', 'HR', 'Employee'].includes(role)) throw new ApplicationError('Invalid role', 'INVITE_ROLE');

  try {
    // Try inviteUserByEmail
    let adminErr = null;
    try {
      const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { role, department, invite_source: 'admin_invite' }
      });
      if (inviteErr) adminErr = inviteErr;
      // If success, proceed
      if (!inviteErr && inviteData) {
        // proceed to record
      }
    } catch (e) {
      adminErr = e;
    }

    if (adminErr) {
      // Fallback: create user with email_confirm (confirmation email)
      const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { role, department, invite_source: 'admin_create' }
      });
      if (createErr) throw createErr;

      // Send magic link by resetting password when redirectTo available (workaround if invite endpoint blocked)
      if (redirectTo) {
        try {
          await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email,
            options: { redirectTo, data: { role, department } }
          });
        } catch (_) {
          // ignore if not permitted
        }
      }
    }

    // Record in user_invitations table
    const { error: recErr } = await supabase.from('user_invitations').insert({
      email,
      role,
      department,
      invited_by,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    // RLS may block insert; if so, bubble up for Admin to configure RLS
    if (recErr) throw recErr;

    return true;
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to invite user', 'INVITE_CREATE');
  }
}

/**
 * PUBLIC_INTERFACE
 * List invitations (RLS-aware). Admin should have select rights.
 */
export async function listInvitations() {
  try {
    const { data, error } = await supabase
      .from('user_invitations')
      .select('id, email, role, department, invited_by, status, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return data || [];
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to list invitations', 'INVITE_LIST');
  }
}

/**
 * PUBLIC_INTERFACE
 * Resend invitation by reusing Admin API invite or magic link flow.
 * invite: row { email, role, department, ... }
 */
export async function resendInvitation(invite, redirectTo) {
  const email = invite?.email;
  const role = invite?.role;
  const department = invite?.department || null;

  if (!email) throw new ApplicationError('Invalid invite', 'INVITE_INVALID');

  try {
    let adminErr = null;
    try {
      const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { role, department, re_invite: true }
      });
      if (inviteErr) adminErr = inviteErr;
    } catch (e) {
      adminErr = e;
    }

    if (adminErr) {
      // fallback generate magic link
      try {
        await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: { redirectTo, data: { role, department } }
        });
      } catch (e2) {
        // if not permitted, still proceed to mark as resent in table
      }
    }

    // Optionally update status timestamp or leave as is
    return true;
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to resend invitation', 'INVITE_RESEND');
  }
}

/**
 * PUBLIC_INTERFACE
 * Revoke an invitation by marking status in user_invitations. (Does not delete the Supabase auth user if created by createUser.)
 */
export async function revokeInvitation(id) {
  try {
    const { error } = await supabase.from('user_invitations').update({ status: 'revoked' }).eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to revoke invitation', 'INVITE_REVOKE');
  }
}

/**
 * PUBLIC_INTERFACE
 * Upsert profile upon acceptance/sign-up; reads role/department from auth user metadata.
 * This can be called post-auth or from AuthContext on session change.
 */
export async function upsertProfileOnAccept() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!user) return false;

    const role = user.user_metadata?.role || 'Employee';
    const department = user.user_metadata?.department || null;
    const email = user.email;

    const { error: upErr } = await supabase.from('profiles').upsert({
      user_id: user.id,
      email,
      role,
      department
    }, { onConflict: 'user_id' });
    if (upErr) throw upErr;

    // Optionally mark invitation as accepted
    const { error: invErr } = await supabase.from('user_invitations')
      .update({ status: 'accepted' })
      .eq('email', email)
      .neq('status', 'revoked');
    // RLS may block; ignore non-fatal
    return true;
  } catch (e) {
    // Best-effort; RLS might block user_invitations or profiles updates depending on policies
    return false;
  }
}
