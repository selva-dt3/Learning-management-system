import React, { useEffect, useState } from 'react';
import { deleteBankQuestion, listBankQuestions, upsertBankQuestion } from '../../services/quizzesService';
import { toUserMessage } from '../../utils/errors';

// PUBLIC_INTERFACE
export default function QuestionBank() {
  /** Question bank CRUD for reusable questions (MCQ/TRUE_FALSE) with per-question points and explanations. */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState({ text: '', type: 'MCQ', options: ['', ''], correctIndex: 0, correctBoolean: true, points: 1, explanation: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await listBankQuestions(200, search);
      setItems(data);
    } catch (e) {
      setMsg(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const saveDraft = async () => {
    setSaving(true);
    setMsg('');
    try {
      await upsertBankQuestion(draft);
      setDraft({ text: '', type: 'MCQ', options: ['', ''], correctIndex: 0, correctBoolean: true, points: 1, explanation: '' });
      await load();
      setMsg('Saved to bank.');
    } catch (e) {
      setMsg(toUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this question from bank?')) return;
    try {
      await deleteBankQuestion(id);
      await load();
    } catch (e) {
      setMsg(toUserMessage(e));
    }
  };

  return (
    <div className="container" style={{ padding: 24 }}>
      <h3>Question Bank</h3>
      {msg && <p style={{ color: msg.includes('Saved') ? 'green' : 'tomato' }}>{msg}</p>}

      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} />
        <button onClick={load}>Search</button>
      </div>

      <div style={{ border: '1px solid var(--border-color)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
        <h4>Add to Bank</h4>
        <div style={{ display: 'grid', gap: 8 }}>
          <input placeholder="Question text" value={draft.text} onChange={e=>setDraft({ ...draft, text: e.target.value })} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label>Type:
              <select value={draft.type} onChange={e=>setDraft({ ...draft, type: e.target.value })} style={{ marginLeft: 8 }}>
                <option value="MCQ">MCQ</option>
                <option value="TRUE_FALSE">True/False</option>
              </select>
            </label>
            <label>Points: <input type="number" min="0" value={draft.points} onChange={e=>setDraft({ ...draft, points: Number(e.target.value) })} style={{ width: 80 }} /></label>
          </div>
          {draft.type === 'MCQ' && (
            <div>
              {(draft.options || []).map((opt, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <input type="radio" name="bank-correct" checked={draft.correctIndex === i} onChange={()=>setDraft({ ...draft, correctIndex: i })} />
                  <input placeholder={`Option ${i+1}`} value={opt} onChange={e=>{
                    const opts = [...(draft.options||[])]; opts[i] = e.target.value; setDraft({ ...draft, options: opts });
                  }} style={{ flex: 1 }} />
                  <button onClick={()=>{
                    const opts = [...(draft.options||[])]; opts.splice(i,1); setDraft({ ...draft, options: opts, correctIndex: Math.max(0, Math.min(draft.correctIndex, opts.length-1)) });
                  }}>✕</button>
                </div>
              ))}
              <button onClick={()=>setDraft({ ...draft, options: [...(draft.options||[]), ''] })}>+ Option</button>
            </div>
          )}
          {draft.type === 'TRUE_FALSE' && (
            <div>
              <label><input type="radio" name="bank-tf" checked={!!draft.correctBoolean} onChange={()=>setDraft({ ...draft, correctBoolean: true })} /> True</label>
              <label style={{ marginLeft: 12 }}><input type="radio" name="bank-tf" checked={!draft.correctBoolean} onChange={()=>setDraft({ ...draft, correctBoolean: false })} /> False</label>
            </div>
          )}
          <textarea placeholder="Explanation (optional)" rows={2} value={draft.explanation} onChange={e=>setDraft({ ...draft, explanation: e.target.value })} />
          <button onClick={saveDraft} disabled={saving || !draft.text}>{saving ? 'Saving...' : 'Save to Bank'}</button>
        </div>
      </div>

      <h4>Bank Items</h4>
      {loading ? <p>Loading...</p> : (
        <ul>
          {items.map(it => (
            <li key={it.id} style={{ marginBottom: 8 }}>
              {it.text} <small style={{ opacity: 0.7 }}>({it.type}, {it.points || 1} pts)</small>
              <button style={{ marginLeft: 8 }} onClick={()=>remove(it.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
