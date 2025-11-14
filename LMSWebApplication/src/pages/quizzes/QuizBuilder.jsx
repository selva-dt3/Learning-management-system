import React, { useState } from 'react';
import { upsertQuizWithQuestions } from '../../services/quizzesService';
import { toUserMessage } from '../../utils/errors';

// PUBLIC_INTERFACE
export default function QuizBuilder() {
  /** Minimal quiz builder for MCQ and True/False with Supabase persistence */
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const addMCQ = () => {
    setQuestions(q => [...q, { text: '', type: 'MCQ', options: ['',''], correctIndex: 0 }]);
  };
  const addTF = () => {
    setQuestions(q => [...q, { text: '', type: 'TRUE_FALSE', correctBoolean: true }]);
  };

  const updateQuestion = (idx, patch) => {
    setQuestions(q => q.map((qq, i) => i === idx ? { ...qq, ...patch } : qq));
  };

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      const quizId = await upsertQuizWithQuestions({ title, description }, questions);
      setMsg(`Saved quiz with id ${quizId}`);
      setTitle(''); setDescription(''); setQuestions([]);
    } catch (e) {
      setMsg(toUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container" style={{ padding: 24 }}>
      <h3>Create Quiz</h3>
      {msg && <p style={{ color: msg.startsWith('Saved') ? 'green' : 'tomato' }}>{msg}</p>}
      <input placeholder="Quiz title" value={title} onChange={e=>setTitle(e.target.value)} />
      <textarea placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} rows={3}/>
      <div style={{ display:'flex', gap:8, marginTop:8 }}>
        <button onClick={addMCQ}>+ Add MCQ</button>
        <button onClick={addTF}>+ Add True/False</button>
      </div>
      <ol style={{ marginTop: 12 }}>
        {questions.map((q, idx) => (
          <li key={idx} style={{ marginBottom: 12 }}>
            <input placeholder="Question text" value={q.text} onChange={e=>updateQuestion(idx, { text: e.target.value })} style={{ width:'100%' }} />
            {q.type === 'MCQ' && (
              <div style={{ marginTop: 6 }}>
                {(q.options || []).map((opt, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <input type="radio" name={`correct-${idx}`} checked={q.correctIndex === i} onChange={()=>updateQuestion(idx, { correctIndex: i })} />
                    <input placeholder={`Option ${i+1}`} value={opt} onChange={e=>{
                      const opts = [...q.options]; opts[i] = e.target.value; updateQuestion(idx, { options: opts });
                    }} />
                  </div>
                ))}
                <button onClick={()=>{
                  const opts = [...(q.options||[]), ''];
                  updateQuestion(idx, { options: opts });
                }}>+ Option</button>
              </div>
            )}
            {q.type === 'TRUE_FALSE' && (
              <div style={{ marginTop: 6 }}>
                <label><input type="radio" name={`tf-${idx}`} checked={!!q.correctBoolean} onChange={()=>updateQuestion(idx, { correctBoolean: true })}/> True</label>
                <label style={{ marginLeft: 12 }}><input type="radio" name={`tf-${idx}`} checked={!q.correctBoolean} onChange={()=>updateQuestion(idx, { correctBoolean: false })}/> False</label>
              </div>
            )}
            <small style={{ opacity: 0.7 }}>Type: {q.type}</small>
          </li>
        ))}
      </ol>
      <button onClick={save} disabled={saving || !title}>{saving ? 'Saving...' : 'Save Quiz'}</button>
    </div>
  );
}
