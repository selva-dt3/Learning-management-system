import React, { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { getQuiz, submitQuiz } from '../../services/quizzesService';
import { toUserMessage } from '../../utils/errors';

export default function TakeQuiz() {
  const supabase = getSupabaseClient();
  const [quizzes, setQuizzes] = useState([]);
  const [selected, setSelected] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('quizzes').select('id, title').order('id', { ascending: false }).limit(50);
      if (!error) setQuizzes(data || []);
    }
    load();
  }, [supabase]);

  const loadQuiz = async () => {
    setLoading(true);
    setMsg('');
    try {
      const { quiz: q, questions } = await getQuiz(selected);
      setQuiz({ ...q, questions });
      setAnswers({});
    } catch (e) {
      setMsg(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const setAnswer = (qid, payload) => {
    setAnswers(a => ({ ...a, [qid]: payload }));
  };

  const onSubmit = async () => {
    setLoading(true);
    setMsg('');
    try {
      const compiled = Object.entries(answers).map(([qid, p]) => {
        const record = { question_id: qid };
        if (p.boolean !== undefined) record.boolean = p.boolean;
        if (p.answer_text) record.answer_text = p.answer_text;
        return record;
      });
      const res = await submitQuiz(quiz.id, compiled);
      setMsg(`Score: ${res.score}% (${res.correct}/${res.total})`);
    } catch (e) {
      setMsg(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: 24 }}>
      <h3>Take Quiz</h3>
      {msg && <p style={{ color: msg.startsWith('Score') ? 'green' : 'tomato' }}>{msg}</p>}
      <div style={{ display:'flex', gap:8 }}>
        <select value={selected} onChange={e=>setSelected(e.target.value)}>
          <option value="">Select a quiz</option>
          {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
        </select>
        <button onClick={loadQuiz} disabled={!selected || loading}>{loading ? 'Loading...' : 'Load'}</button>
      </div>
      {quiz && (
        <div style={{ marginTop: 16 }}>
          <h4>{quiz.title}</h4>
          <ol>
            {quiz.questions.map(q => (
              <li key={q.id} style={{ marginBottom: 12 }}>
                <div>{q.text}</div>
                {q.type === 'MCQ' && (
                  <div>
                    {q.options.map((opt, idx) => (
                      <label key={idx} style={{ display:'block' }}>
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          onChange={()=>setAnswer(q.id, { answer_text: opt })}
                          checked={answers[q.id]?.answer_text === opt}
                        /> {opt}
                      </label>
                    ))}
                  </div>
                )}
                {q.type === 'TRUE_FALSE' && (
                  <div>
                    <label><input type="radio" name={`q-${q.id}`} checked={answers[q.id]?.boolean === true} onChange={()=>setAnswer(q.id, { boolean: true })} /> True</label>
                    <label style={{ marginLeft: 12 }}><input type="radio" name={`q-${q.id}`} checked={answers[q.id]?.boolean === false} onChange={()=>setAnswer(q.id, { boolean: false })} /> False</label>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <button onClick={onSubmit} disabled={loading || !Object.keys(answers).length}>{loading ? 'Submitting...' : 'Submit'}</button>
        </div>
      )}
    </div>
  );
}
