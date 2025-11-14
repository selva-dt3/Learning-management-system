import React, { useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { getQuiz, submitQuiz } from '../../services/quizzesService';
import { toUserMessage } from '../../utils/errors';
import { getActiveAssignmentForUser, getAttemptsUsed } from '../../services/assignmentsService';

export default function TakeQuiz() {
  const supabase = getSupabaseClient();
  const [quizzes, setQuizzes] = useState([]);
  const [selected, setSelected] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('all'); // 'all' | 'one'
  const [index, setIndex] = useState(0);
  const [timer, setTimer] = useState(null);
  const [remaining, setRemaining] = useState(null);
  const [result, setResult] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [attemptsInfo, setAttemptsInfo] = useState({ used: 0, allowed: 1 });

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('quizzes').select('id, title').order('id', { ascending: false }).limit(50);
      if (!error) setQuizzes(data || []);
    }
    load();
  }, [supabase]);

  const checkAssignment = async (quizId) => {
    // Resolve active assignment and attempts
    const a = await getActiveAssignmentForUser(quizId);
    if (!a) throw new Error('No active assignment found for this quiz, or it is not currently open.');
    const used = await getAttemptsUsed(quizId);
    const allowed = Number.isFinite(a.attempts_allowed) ? a.attempts_allowed : 1;
    if (used >= allowed) {
      throw new Error(`No attempts remaining. Used ${used}/${allowed}.`);
    }
    setAssignment(a);
    setAttemptsInfo({ used, allowed });
  };

  const loadQuiz = async () => {
    setLoading(true);
    setMsg('');
    setResult(null);
    setAssignment(null);
    try {
      // enforce assignment before loading
      await checkAssignment(selected);

      const { quiz: q, questions } = await getQuiz(selected);
      setQuiz({ ...q, questions });
      setAnswers({});
      setIndex(0);
      // timer
      if (q.time_limit_sec && Number(q.time_limit_sec) > 0) {
        setRemaining(Number(q.time_limit_sec));
        if (timer) clearInterval(timer);
        const t = setInterval(() => {
          setRemaining(prev => {
            if (prev === null) return prev;
            if (prev <= 1) {
              clearInterval(t);
              // auto-submit
              onSubmit(true);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        setTimer(t);
      } else {
        setRemaining(null);
        if (timer) clearInterval(timer);
        setTimer(null);
      }
    } catch (e) {
      setMsg(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => { if (timer) clearInterval(timer); };
  }, [timer]);

  const setAnswer = (qid, payload) => {
    setAnswers(a => ({ ...a, [qid]: payload }));
  };

  const compiledAnswers = useMemo(() => {
    return Object.entries(answers).map(([qid, p]) => {
      const record = { question_id: qid };
      if (p.boolean !== undefined) record.boolean = p.boolean;
      if (p.answer_text) record.answer_text = p.answer_text;
      return record;
    });
  }, [answers]);

  const validate = () => {
    if (!quiz) return false;
    for (const q of quiz.questions) {
      const a = answers[q.id];
      if (!a) return false;
      if (q.type === 'MCQ' && !a.answer_text) return false;
      if (q.type === 'TRUE_FALSE' && typeof a.boolean !== 'boolean') return false;
    }
    return true;
  };

  const onSubmit = async (auto = false) => {
    setLoading(true);
    setMsg('');
    try {
      if (!auto && !validate()) {
        setMsg('Please answer all questions.');
        setLoading(false);
        return;
      }
      // attempt guard again before submitting (race-safe)
      await checkAssignment(quiz.id);

      const res = await submitQuiz(quiz.id, compiledAnswers, { allowMultiple: attemptsInfo.allowed > 1 });
      setResult(res);
      setMsg(`Score: ${res.scorePercent}% (${res.earnedPoints}/${res.totalPoints} pts)`);
      if (timer) clearInterval(timer);
      setTimer(null);
    } catch (e) {
      setMsg(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const renderQuestion = (q) => {
    return (
      <div>
        <div style={{ fontWeight: 600 }}>{q.text} <small>({q.points || 1} pts)</small></div>
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
      </div>
    );
  };

  return (
    <div className="container" style={{ padding: 24 }}>
      <h3>Take Quiz</h3>
      {msg && <p style={{ color: msg.startsWith('Score') ? 'green' : 'tomato' }}>{msg}</p>}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <select value={selected} onChange={e=>setSelected(e.target.value)}>
          <option value="">Select a quiz</option>
          {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
        </select>
        <select value={mode} onChange={e=>setMode(e.target.value)}>
          <option value="all">All-at-once</option>
          <option value="one">One-by-one</option>
        </select>
        <button onClick={loadQuiz} disabled={!selected || loading}>{loading ? 'Loading...' : 'Load'}</button>
        {remaining !== null && <span style={{ marginLeft: 8 }}>⏱ {remaining}s</span>}
        {assignment && <span style={{ marginLeft: 'auto' }}>Attempts: {attemptsInfo.used}/{attemptsInfo.allowed}</span>}
      </div>

      {quiz && !result && (
        <div style={{ marginTop: 16 }}>
          <h4>{quiz.title}</h4>
          {mode === 'all' ? (
            <>
              <ol>
                {quiz.questions.map(q => (
                  <li key={q.id} style={{ marginBottom: 12 }}>
                    {renderQuestion(q)}
                  </li>
                ))}
              </ol>
              <button onClick={onSubmit} disabled={loading || !validate()}>{loading ? 'Submitting...' : 'Submit'}</button>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <div>Question {index + 1} of {quiz.questions.length}</div>
                {renderQuestion(quiz.questions[index])}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button disabled={index === 0} onClick={()=>setIndex(i=>i-1)}>Back</button>
                {index < quiz.questions.length - 1 ? (
                  <button onClick={()=>setIndex(i=>i+1)}>Next</button>
                ) : (
                  <button onClick={onSubmit} disabled={loading || !validate()}>{loading ? 'Submitting...' : 'Submit'}</button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16 }}>
          <h4>Review</h4>
          <p>Score: {result.scorePercent}% ({result.earnedPoints}/{result.totalPoints} pts)</p>
          <ol>
            {result.items.map((it) => {
              const q = quiz.questions.find(qq => String(qq.id) === String(it.question_id));
              return (
                <li key={it.question_id} style={{ marginBottom: 10 }}>
                  <div><strong>{q?.text || `Q ${it.question_id}`}</strong> · {it.is_correct ? '✔ Correct' : '✘ Incorrect'} ({it.earned}/{it.points} pts)</div>
                  <div>Your answer: {String(it.selected)} · Correct: {String(it.correct)}</div>
                  {q?.explanation && <small>Explanation: {q.explanation}</small>}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
