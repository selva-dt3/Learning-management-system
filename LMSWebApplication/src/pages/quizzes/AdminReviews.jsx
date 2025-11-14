import React, { useEffect, useState } from 'react';
import { getSubmissionDetail, listSubmissions, updateSubmissionStatus } from '../../services/quizzesService';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { toUserMessage } from '../../utils/errors';

// PUBLIC_INTERFACE
export default function AdminReviews() {
  /** Admin/HR review list with filters, per-user attempt detail, and status updates. */
  const supabase = getSupabaseClient();
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState('');
  const [subs, setSubs] = useState([]);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadQuizzes() {
      const { data, error } = await supabase.from('quizzes').select('id, title').order('id', { ascending: false }).limit(200);
      if (!error) setQuizzes(data || []);
    }
    loadQuizzes();
  }, [supabase]);

  const loadSubs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listSubmissions(selectedQuiz);
      setSubs(data);
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const showDetail = async (id) => {
    setLoading(true);
    try {
      const d = await getSubmissionDetail(id);
      setDetail(d);
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const changeStatus = async (id, status) => {
    try {
      await updateSubmissionStatus(id, status);
      await loadSubs();
      if (detail?.submission?.id === id) setDetail({ ...detail, submission: { ...detail.submission, status } });
    } catch (e) {
      setError(toUserMessage(e));
    }
  };

  return (
    <div className="container" style={{ padding: 24 }}>
      <h3>Quiz Reviews</h3>
      {error && <p style={{ color: 'tomato' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={selectedQuiz} onChange={e=>setSelectedQuiz(e.target.value)}>
          <option value="">Select quiz</option>
          {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
        </select>
        <button onClick={loadSubs} disabled={!selectedQuiz || loading}>{loading ? 'Loading...' : 'Load'}</button>
      </div>

      {subs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4>Submissions</h4>
          <ul>
            {subs.map(s => (
              <li key={s.id} style={{ marginBottom: 8 }}>
                <span>Submission {s.id.slice(0, 8)} · Score {s.score}% · {new Date(s.submitted_at).toLocaleString()} · status: {s.status}</span>
                <button style={{ marginLeft: 8 }} onClick={()=>showDetail(s.id)}>View</button>
                <select style={{ marginLeft: 8 }} value={s.status} onChange={e => changeStatus(s.id, e.target.value)}>
                  <option value="submitted">submitted</option>
                  <option value="reopened">reopened</option>
                  <option value="invalidated">invalidated</option>
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail && (
        <div style={{ marginTop: 16 }}>
          <h4>Attempt Detail</h4>
          <p>Submission: {detail.submission.id} · Score: {detail.submission.score}% · Status: {detail.submission.status}</p>
          <ol>
            {detail.items.map(it => (
              <li key={it.id || it.question_id} style={{ marginBottom: 10 }}>
                <div><strong>{it.question?.text || `Q ${it.question_id}`}</strong></div>
                <div>Selected: {String(it.selected)} · Correct: {String(it.correct)} · {it.is_correct ? '✔' : '✘'} ({it.earned}/{it.points} pts)</div>
                {it.question?.explanation && <small>Explanation: {it.question.explanation}</small>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
