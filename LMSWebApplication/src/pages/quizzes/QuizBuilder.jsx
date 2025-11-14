import React, { useEffect, useState } from 'react';
import { addBankQuestionToQuiz, listBankQuestions, upsertQuizWithQuestions } from '../../services/quizzesService';
import { toUserMessage } from '../../utils/errors';

// PUBLIC_INTERFACE
export default function QuizBuilder() {
  /** Quiz builder with MCQ/True-False, per-question points, explanation, shuffle and time limit, plus add from question bank. */
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [shuffle, setShuffle] = useState(false);
  const [timeLimit, setTimeLimit] = useState('');
  const [questions, setQuestions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [bank, setBank] = useState([]);
  const [loadingBank, setLoadingBank] = useState(false);

  useEffect(() => {
    async function loadBank() {
      setLoadingBank(true);
      try {
        const data = await listBankQuestions(200);
        setBank(data);
      } catch (_) {
        // soft ignore, bank is optional
      } finally {
        setLoadingBank(false);
      }
    }
    loadBank();
  }, []);

  const addMCQ = () => {
    setQuestions(q => [...q, { text: '', type: 'MCQ', options: ['', ''], correctIndex: 0, points: 1, explanation: '' }]);
  };
  const addTF = () => {
    setQuestions(q => [...q, { text: '', type: 'TRUE_FALSE', correctBoolean: true, points: 1, explanation: '' }]);
  };

  const updateQuestion = (idx, patch) => {
    setQuestions(q => q.map((qq, i) => i === idx ? { ...qq, ...patch } : qq));
  };

  const removeQuestion = (idx) => {
    setQuestions(q => q.filter((_, i) => i !== idx));
  };

  const addFromBank = async (bankId) => {
    try {
      setSaving(true);
      setMsg('');
      // Save or create a draft quiz first to have an id
      const quizId = await upsertQuizWithQuestions({ title: title || 'Untitled Quiz', description, shuffle, time_limit_sec: timeLimit ? Number(timeLimit) : null }, questions);
      await addBankQuestionToQuiz(quizId, bankId);
      setMsg('Added question from bank to this quiz. You may reload the quiz later to edit copied items.');
    } catch (e) {
      setMsg(toUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      const quizId = await upsertQuizWithQuestions(
        { title, description, shuffle, time_limit_sec: timeLimit ? Number(timeLimit) : null },
        questions
      );
      setMsg(`Saved quiz with id ${quizId}`);
      setTitle(''); setDescription(''); setQuestions([]); setShuffle(false); setTimeLimit('');
    } catch (e) {
      setMsg(toUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container" style={{ padding: 24 }}>
      <h3>Create Quiz</h3>
      {msg && <p style={{ color: msg.startsWith('Saved') || msg.includes('Added') ? 'green' : 'tomato' }}>{msg}</p>}
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr' }}>
        <input placeholder="Quiz title" value={title} onChange={e=>setTitle(e.target.value)} />
        <textarea placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} rows={3}/>
        <div style={{ display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
          <label><input type="checkbox" checked={shuffle} onChange={e=>setShuffle(e.target.checked)} /> Shuffle questions</label>
          <label>Time limit (seconds): <input type="number" min="0" inputMode="numeric" value={timeLimit} onChange={e=>setTimeLimit(e.target.value)} style={{ width: 120 }} /></label>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap' }}>
        <button onClick={addMCQ}>+ Add MCQ</button>
        <button onClick={addTF}>+ Add True/False</button>
      </div>

      <ol style={{ marginTop: 12 }}>
        {questions.map((q, idx) => (
          <li key={idx} style={{ marginBottom: 12, border: '1px solid var(--border-color)', padding: 8, borderRadius: 8 }}>
            <div style={{ display:'grid', gap:6 }}>
              <input placeholder="Question text" value={q.text} onChange={e=>updateQuestion(idx, { text: e.target.value })} style={{ width:'100%' }} />
              <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
                <label>Points: <input type="number" min="0" value={q.points ?? 1} onChange={e=>updateQuestion(idx, { points: Number(e.target.value) })} style={{ width: 80 }} /></label>
                <span style={{ opacity: 0.7 }}>Type: {q.type}</span>
                <button type="button" onClick={()=>removeQuestion(idx)} style={{ marginLeft: 'auto' }}>Remove</button>
              </div>
              {q.type === 'MCQ' && (
                <div style={{ marginTop: 6 }}>
                  {(q.options || []).map((opt, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom: 4 }}>
                      <input type="radio" name={`correct-${idx}`} checked={q.correctIndex === i} onChange={()=>updateQuestion(idx, { correctIndex: i })} />
                      <input placeholder={`Option ${i+1}`} value={opt} onChange={e=>{
                        const opts = [...(q.options||[])]; opts[i] = e.target.value; updateQuestion(idx, { options: opts });
                      }} style={{ flex: 1 }} />
                      <button type="button" onClick={()=>{
                        const opts = [...(q.options||[])]; opts.splice(i,1); updateQuestion(idx, { options: opts, correctIndex: Math.max(0, Math.min(q.correctIndex ?? 0, opts.length-1)) });
                      }} aria-label="Remove option">✕</button>
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
              <textarea placeholder="Explanation (shown in review)" value={q.explanation || ''} onChange={e=>updateQuestion(idx, { explanation: e.target.value })} rows={2} />
            </div>
          </li>
        ))}
      </ol>

      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <button onClick={save} disabled={saving || !title}>{saving ? 'Saving...' : 'Save Quiz'}</button>
      </div>

      <hr style={{ margin: '16px 0' }} />
      <h4>Question Bank</h4>
      {loadingBank ? <p>Loading...</p> : (
        <ul>
          {bank.map(q => (
            <li key={q.id} style={{ marginBottom: 8 }}>
              <span>{q.text} <small style={{ opacity: 0.7 }}>({q.type}, {q.points || 1} pts)</small></span>
              <button style={{ marginLeft: 8 }} onClick={()=>addFromBank(q.id)}>Add to this quiz</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
