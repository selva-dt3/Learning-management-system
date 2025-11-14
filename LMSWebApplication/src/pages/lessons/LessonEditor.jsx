import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { toUserMessage } from '../../utils/errors';
import { uploadLessonFile } from '../../services/storageService';

export default function LessonEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const supabase = getSupabaseClient();

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('draft');
  const [description, setDescription] = useState('');
  const [filePath, setFilePath] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  async function load() {
    if (id === 'new') return;
    const { data, error: qErr } = await supabase.from('lessons').select('*').eq('id', id).single();
    if (qErr) { setError(toUserMessage(qErr)); return; }
    setTitle(data.title || '');
    setDescription(data.description || '');
    setStatus(data.status || 'draft');
    setFilePath(data.storage_path || '');
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const onFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // basic validation: allow pdf, mp4, webm up to ~50MB
    const allowed = ['application/pdf', 'video/mp4', 'video/webm'];
    if (!allowed.includes(file.type)) {
      setError('Unsupported file type. Allowed: PDF, MP4, WEBM');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('File too large. Max 50MB.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const filename = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const bucket = 'lesson-files';
      const path = `uploads/${filename}`;
      const storagePath = await uploadLessonFile(bucket, path, file);
      setFilePath(storagePath);
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (id === 'new') {
        const { error: insErr } = await supabase.from('lessons').insert({ title, description, status, storage_path: filePath });
        if (insErr) throw insErr;
      } else {
        const { error: upErr } = await supabase.from('lessons').update({ title, description, status, storage_path: filePath }).eq('id', id);
        if (upErr) throw upErr;
      }
      navigate('/lessons');
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!id || id === 'new') return;
    if (!window.confirm('Delete this lesson?')) return;
    const { error: delErr } = await supabase.from('lessons').delete().eq('id', id);
    if (delErr) { setError(toUserMessage(delErr)); return; }
    navigate('/lessons');
  };

  return (
    <div className="container" style={{ padding: 24, display:'flex', flexDirection:'column', gap:12 }}>
      <h2>{id === 'new' ? 'Create Lesson' : 'Edit Lesson'}</h2>
      {error && <p style={{ color:'tomato' }}>{error}</p>}
      <input placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
      <textarea placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} rows={4} />
      <select value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="draft">Draft</option>
        <option value="published">Published</option>
      </select>

      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <input placeholder="Storage path (e.g., lesson-files/intro.pdf)" value={filePath} onChange={e=>setFilePath(e.target.value)} style={{ flex:'1 1 300px' }} />
        <label style={{ border:'1px solid var(--border-color)', padding:'6px 10px', borderRadius:6, cursor:'pointer' }}>
          {uploading ? 'Uploading...' : 'Upload file'}
          <input type="file" onChange={onFileSelect} style={{ display:'none' }} accept=".pdf,video/mp4,video/webm" />
        </label>
      </div>

      <div style={{ display:'flex', gap:8 }}>
        <button onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        {id !== 'new' && <button onClick={onDelete} style={{ background:'tomato', color:'#fff' }}>Delete</button>}
      </div>
      <small>Tip: Upload files to Supabase Storage bucket (e.g., lesson-files). Uploaded files are stored under lesson-files/uploads/.</small>
    </div>
  );
}
