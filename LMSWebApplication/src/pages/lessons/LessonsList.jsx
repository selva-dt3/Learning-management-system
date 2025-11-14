import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { toUserMessage } from '../../utils/errors';

export default function LessonsList() {
  const supabase = getSupabaseClient();
  const { isAdmin, isHR } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function fetchLessons() {
    setLoading(true);
    setError('');
    try {
      // RLS expected: only published or assigned; admins can see all per policy
      const query = supabase
        .from('lessons')
        .select('id, title, status, updated_at, lesson_assignments(count)')
        .order('updated_at', { ascending: false });
      const { data, error: qErr } = await query;
      if (qErr) throw qErr;
      setLessons((data || []).map(l => ({ ...l, assignedCount: l.lesson_assignments?.[0]?.count || 0 })));
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLessons();
    const channel = supabase
      .channel('lms-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lessons' }, fetchLessons)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_progress' }, fetchLessons)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container" style={{ padding: 24 }}>
      <h2>Lessons</h2>
      {(isAdmin || isHR) && <Link to="/lessons/new">+ Create Lesson</Link>}
      {loading ? <p>Loading...</p> : error ? <p style={{ color:'tomato' }}>{error}</p> : (
        <ul>
          {lessons.map(l => (
            <li key={l.id} style={{ marginBottom: 8 }}>
              <Link to={`/lessons/${l.id}`}>{l.title}</Link> <span style={{ opacity: 0.7 }}>({l.status})</span> {l.assignedCount ? <span style={{ marginLeft:6, fontSize:12, opacity:0.7 }}>· assigned: {l.assignedCount}</span> : null}
              {(isAdmin || isHR) && <> · <Link to={`/lessons/${l.id}/edit`}>Edit</Link></>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
