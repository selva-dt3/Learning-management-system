import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toUserMessage } from '../../utils/errors';
import { getSupabaseClient, getSiteRedirectUrl } from '../../lib/supabaseClient';
import { adminInviteUser, listInvitations, revokeInvitation, resendInvitation, upsertProfileOnAccept } from '../../services/invitationsService';

/**
 * Admin-only page to invite users by email with predefined role and optional department.
 * - Uses Supabase Admin API to send invites (requires service role on server; anon keys may be limited)
 * - Records pending invites in user_invitations table
 * - Lists invites with simple revoke/resend actions
 * - On acceptance, profile upsert logic is available via upsertProfileOnAccept (triggerable via metadata flow)
 */
export default function UsersInvitesPage() {
  const { isAdmin, user } = useAuth();
  const supabase = getSupabaseClient();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Employee');
  const [department, setDepartment] = useState('');
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(false);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const allowedRoles = useMemo(() => ['Admin', 'HR', 'Employee'], []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const data = await listInvitations();
      setItems(data);
    } catch (e) {
      setMessage(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const onInvite = async (e) => {
    e.preventDefault();
    setMessage('');
    setProcessing(true);
    try {
      if (!email || !email.includes('@')) throw new Error('Please enter a valid email.');
      if (!allowedRoles.includes(role)) throw new Error('Invalid role.');

      // Admin API invite path; fallback to createUser+email_confirm if invite endpoint is restricted in current env.
      const redirectTo = `${getSiteRedirectUrl() || window.location.origin}/auth/callback`;
      await adminInviteUser({
        email,
        role,
        department: department || null,
        invited_by: user?.id || null,
        redirectTo
      });

      setEmail('');
      setDepartment('');
      setRole('Employee');
      setMessage('Invitation sent.');
      await load();
    } catch (err) {
      setMessage(toUserMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  const onRevoke = async (id) => {
    if (!window.confirm('Revoke this invitation?')) return;
    setMessage('');
    try {
      await revokeInvitation(id);
      await load();
    } catch (e) {
      setMessage(toUserMessage(e));
    }
  };

  const onResend = async (invite) => {
    setMessage('');
    try {
      const redirectTo = `${getSiteRedirectUrl() || window.location.origin}/auth/callback`;
      await resendInvitation(invite, redirectTo);
      setMessage('Invitation resent.');
    } catch (e) {
      setMessage(toUserMessage(e));
    }
  };

  if (!isAdmin) {
    return <div className="container" style={{ padding: 24 }}><p>Access denied.</p></div>;
  }

  return (
    <div className="container" style={{ padding: 24 }}>
      <h2>User Invitations</h2>
      <p>Invite users by email with a predefined role and optional department.</p>
      {message && <p style={{ color: message.includes('sent') || message.includes('res') ? 'green' : 'tomato' }}>{message}</p>}

      <form onSubmit={onInvite} style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
        <input
          type="email"
          placeholder="email@company.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label>Role
            <select value={role} onChange={e => setRole(e.target.value)} style={{ marginLeft: 8 }}>
              {allowedRoles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <input
            placeholder="Department (optional)"
            value={department}
            onChange={e => setDepartment(e.target.value)}
          />
        </div>
        <button type="submit" disabled={processing}>{processing ? 'Inviting...' : 'Send Invite'}</button>
      </form>

      <hr style={{ margin: '16px 0' }} />
      <h3>Pending / Sent Invites</h3>
      {loading ? <p>Loading...</p> : (
        <ul>
          {(items || []).map(inv => (
            <li key={inv.id} style={{ marginBottom: 8, border: '1px solid var(--border-color)', padding: 8, borderRadius: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>{inv.email}</strong>
                <span>· role: {inv.role}</span>
                {inv.department && <span>· dept: {inv.department}</span>}
                <span>· status: {inv.status}</span>
                <small style={{ opacity: 0.7 }}>· invited {inv.created_at ? new Date(inv.created_at).toLocaleString() : ''}</small>
                <button style={{ marginLeft: 'auto' }} onClick={() => onResend(inv)}>Resend</button>
                {inv.status !== 'revoked' && <button onClick={() => onRevoke(inv.id)} style={{ background: 'tomato', color: '#fff' }}>Revoke</button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <small>
        Notes:
        <ul>
          <li>Invites use Supabase Admin API. In environments where only anon key is available, admin endpoints may be restricted; in that case, you can fall back to createUser with email confirmation.</li>
          <li>On acceptance, user metadata contains role/department; profiles upsert should enforce that role and department (RLS permitting).</li>
        </ul>
      </small>
    </div>
  );
}
