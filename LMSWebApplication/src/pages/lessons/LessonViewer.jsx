import React, { useEffect, useMemo, useState } from 'react';
import { markLessonComplete } from '../../services/lessonsService';
import { useParams } from 'react-router-dom';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { toUserMessage } from '../../utils/errors';

export default function LessonViewer() {
  const { id } = useParams();
  const supabase = getSupabaseClient();
  const [lesson, setLesson] = useState(null);
  const [signedUrl, setSignedUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setError('');
      const { data, error: qErr } = await supabase.from('lessons').select('id, title, description, storage_path').eq('id', id).single();
      if (qErr) { setError(toUserMessage(qErr)); return; }
      setLesson(data);
      if (data?.storage_path) {
        const [bucket, ...rest] = data.storage_path.split('/');
        const path = rest.join('/');
        const { data: urlData, error: urlErr } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
        if (urlErr) { setError(toUserMessage(urlErr)); return; }
        setSignedUrl(urlData?.signedUrl || '');
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const ext = useMemo(() => {
    if (!lesson?.storage_path) return '';
    const p = lesson.storage_path.toLowerCase();
    if (p.endsWith('.pdf')) return 'pdf';
    if (p.endsWith('.mp4') || p.endsWith('.webm')) return 'video';
    return 'unknown';
  }, [lesson]);

  if (error) return <div className="container" style={{ padding: 24 }}><p style={{ color:'tomato' }}>{error}</p></div>;
  if (!lesson) return <div className="container" style={{ padding: 24 }}>Loading...</div>;

  return (
    <div className="container" style={{ padding: 24 }}>
      <h2>{lesson.title}</h2>
      <p>{lesson.description}</p>
      <MarkCompleteButton lessonId={lesson.id} />
      {signedUrl && ext === 'pdf' && <iframe title="PDF" src={signedUrl} style={{ width:'100%', height: '70vh', border: '1px solid var(--border-color)' }}/>}
      {signedUrl && ext === 'video' && <video src={signedUrl} controls style={{ width:'100%', maxHeight: '70vh' }} />}
      {!signedUrl && <p>No content file linked for this lesson.</p>}
    </div>
  );
}

function MarkCompleteButton({ lessonId }) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const onClick = async () => {
    setSaving(true);
    setMsg('');
    try {
      await markLessonComplete(lessonId);
      setMsg('Marked complete ✔');
    } catch (e) {
      setMsg(e?.message || 'Failed to mark complete');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div style={{ margin: '12px 0' }}>
      <button onClick={onClick} disabled={saving}>{saving ? 'Working...' : 'Mark Complete'}</button>
      {msg && <span style={{ marginLeft: 8, color: msg.includes('✔') ? 'green' : 'tomato' }}>{msg}</span>}
    </div>
  );
}
