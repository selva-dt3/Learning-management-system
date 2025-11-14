import React, { useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { toUserMessage } from '../../utils/errors';
import { createAssignment, listAssignments, revokeAssignment, updateAssignment } from '../../services/assignmentsService';

// PUBLIC_INTERFACE
export default function Assignments() {
  /** Admin/HR: Manage quiz assignments to users, groups (departments), and lessons. */
  const supabase = getSupabaseClient();
  const [quizzes, setQuizzes] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({ quiz_id: '', assignee_type: '' });
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    async function preload() {
      try {
        const [{ data: qz }, { data: ls }, { data: pf }] = await Promise.all([
          supabase.from('quizzes').select('id, title').order('id', { ascending: false }).limit(200),
          supabase.from('lessons').select('id, title').order('updated_at', { ascending: false }).limit(200),
          supabase.from('profiles').select('user_id, full_name, email, department').limit(500),
        ]);
        setQuizzes(qz || []);
        setLessons(ls || []);
        setProfiles(pf || []);
        const depts = Array.from(new Set((pf || []).map(p => p.department).filter(Boolean)));
        setDepartments(depts);
      } catch (_) {}
    }
    preload();
  }, [supabase]);

  const load = async () => {
    setLoading(true);
    setMsg('');
    try {
      const data = await listAssignments(filters);
      setItems(data);
    } catch (e) {
      setMsg(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const onRevoke = async (id) => {
    if (!window.confirm('Revoke this assignment?')) return;
    try {
      await revokeAssignment(id);
      await load();
    } catch (e) {
      setMsg(toUserMessage(e));
    }
  };

  const onInlineUpdate = async (id, patch) => {
    try {
      await updateAssignment(id, patch);
      await load();
    } catch (e) {
      setMsg(toUserMessage(e));
    }
  };

  const quizTitle = useMemo(() => (id) => quizzes.find(q => String(q.id) === String(id))?.title || id, [quizzes]);

  return (
    <div className="container" style={{ padding: 24 }}>
      <h3>Quiz Assignments</h3>
      {msg && <p style={{ color: msg.includes('Failed') ? 'tomato' : 'green' }}>{msg}</p>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={filters.quiz_id} onChange={e=>setFilters(f=>({...f, quiz_id: e.target.value}))}>
          <option value="">Filter by quiz</option>
          {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
        </select>
        <select value={filters.assignee_type} onChange={e=>setFilters(f=>({...f, assignee_type: e.target.value}))}>
          <option value="">All assignee types</option>
          <option value="user">User</option>
          <option value="group">Group/Department</option>
          <option value="lesson">Lesson</option>
        </select>
        <button onClick={load} disabled={loading}>{loading ? 'Loading...' : 'Apply'}</button>
        <button onClick={()=>setShowDialog(true)} style={{ marginLeft: 'auto' }}>+ New Assignment</button>
      </div>

      <ul style={{ marginTop: 16 }}>
        {items.map(it => (
          <li key={it.id} style={{ marginBottom: 10, border: '1px solid var(--border-color)', padding: 8, borderRadius: 8 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <strong>{quizTitle(it.quiz_id)}</strong>
              <span>· {it.assignee_type} → {String(it.assignee_id).slice(0, 8)}</span>
              <span>· attempts: {it.attempts_allowed ?? 1}</span>
              <small style={{ opacity: 0.7 }}>
                {it.opens_at ? ` · opens ${new Date(it.opens_at).toLocaleString()}` : '' }
                {it.closes_at ? ` · closes ${new Date(it.closes_at).toLocaleString()}` : '' }
                {it.due_at ? ` · due ${new Date(it.due_at).toLocaleDateString()}` : '' }
              </small>
              <button style={{ marginLeft: 'auto', background: 'tomato', color: '#fff' }} onClick={()=>onRevoke(it.id)}>Revoke</button>
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <label>Due:
                <input type="date" onChange={e=>onInlineUpdate(it.id, { due_at: e.target.value ? new Date(e.target.value).toISOString() : null })}/>
              </label>
              <label>Opens:
                <input type="datetime-local" onChange={e=>onInlineUpdate(it.id, { opens_at: e.target.value ? new Date(e.target.value).toISOString() : null })}/>
              </label>
              <label>Closes:
                <input type="datetime-local" onChange={e=>onInlineUpdate(it.id, { closes_at: e.target.value ? new Date(e.target.value).toISOString() : null })}/>
              </label>
              <label>Attempts:
                <input type="number" min="1" defaultValue={it.attempts_allowed || 1} onBlur={e=>onInlineUpdate(it.id, { attempts_allowed: Number(e.target.value) })} style={{ width: 80 }}/>
              </label>
            </div>
          </li>
        ))}
      </ul>

      {showDialog && (
        <AssignmentDialog
          quizzes={quizzes}
          lessons={lessons}
          profiles={profiles}
          departments={departments}
          onClose={()=>setShowDialog(false)}
          onCreated={async ()=>{ setShowDialog(false); await load(); }}
        />
      )}
    </div>
  );
}

function AssignmentDialog({ quizzes, lessons, profiles, departments, onClose, onCreated }) {
  const [quizId, setQuizId] = useState('');
  const [type, setType] = useState('user');
  const [assigneeId, setAssigneeId] = useState('');
  const [due, setDue] = useState('');
  const [opens, setOpens] = useState('');
  const [closes, setCloses] = useState('');
  const [attempts, setAttempts] = useState(1);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = quizId && type && assigneeId && attempts >= 1;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setMsg('');
    try {
      await createAssignment({
        quiz_id: quizId,
        assignee_type: type,
        assignee_id: assigneeId,
        due_at: due ? new Date(due).toISOString() : null,
        opens_at: opens ? new Date(opens).toISOString() : null,
        closes_at: closes ? new Date(closes).toISOString() : null,
        attempts_allowed: Number(attempts),
      });
      setMsg('Assignment created.');
      await onCreated();
    } catch (e) {
      setMsg(toUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: 16, borderRadius: 10, width: 480, maxWidth: '95vw' }}>
        <h4>New Assignment</h4>
        {msg && <p style={{ color: msg.includes('created') ? 'green' : 'tomato' }}>{msg}</p>}
        <div style={{ display: 'grid', gap: 8 }}>
          <label>Quiz
            <select value={quizId} onChange={e=>setQuizId(e.target.value)}>
              <option value="">Select quiz</option>
              {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
            </select>
          </label>
          <label>Assignee Type
            <select value={type} onChange={e=>{ setType(e.target.value); setAssigneeId(''); }}>
              <option value="user">User</option>
              <option value="group">Group/Department</option>
              <option value="lesson">Lesson</option>
            </select>
          </label>
          {type === 'user' && (
            <label>User
              <select value={assigneeId} onChange={e=>setAssigneeId(e.target.value)}>
                <option value="">Select user</option>
                {profiles.map(p => <option key={p.user_id} value={p.user_id}>{p.full_name || p.email} ({p.user_id.slice(0,8)})</option>)}
              </select>
            </label>
          )}
          {type === 'group' && (
            <label>Department/Group
              <select value={assigneeId} onChange={e=>setAssigneeId(e.target.value)}>
                <option value="">Select department</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          )}
          {type === 'lesson' && (
            <label>Lesson
              <select value={assigneeId} onChange={e=>setAssigneeId(e.target.value)}>
                <option value="">Select lesson</option>
                {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </label>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label>Due date <input type="date" value={due} onChange={e=>setDue(e.target.value)} /></label>
            <label>Opens <input type="datetime-local" value={opens} onChange={e=>setOpens(e.target.value)} /></label>
            <label>Closes <input type="datetime-local" value={closes} onChange={e=>setCloses(e.target.value)} /></label>
          </div>
          <label>Attempts Allowed <input type="number" min="1" value={attempts} onChange={e=>setAttempts(Number(e.target.value || 1))} style={{ width: 100 }}/></label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={onSave} disabled={!canSave || saving}>{saving ? 'Saving...' : 'Create'}</button>
          <button onClick={onClose} style={{ marginLeft: 'auto' }}>Close</button>
        </div>
        <small>Note: Group refers to profiles.department via server-side view mapping; ensure RLS allows Admin/HR to manage assignments.</small>
      </div>
    </div>
  );
}
