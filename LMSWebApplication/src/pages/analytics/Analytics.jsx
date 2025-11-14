import React, { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { toUserMessage } from '../../utils/errors';
import { getQuizAnalytics } from '../../services/quizzesService';

export default function Analytics() {
  const supabase = getSupabaseClient();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState('');
  const [quizAnalytics, setQuizAnalytics] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        // RLS should filter rows per role automatically
        const { data: progress, error: pErr } = await supabase
          .from('lesson_progress')
          .select('lesson_id, completed')
          .limit(5000);
        if (pErr) throw pErr;
        const completionRate = progress?.length
          ? (progress.filter(p => p.completed).length / progress.length) * 100
          : 0;

        const { data: submissions, error: sErr } = await supabase
          .from('quiz_submissions')
          .select('score')
          .limit(5000);
        if (sErr) throw sErr;
        const avgQuiz = submissions?.length
          ? Math.round(submissions.reduce((a,b)=>a + (b.score || 0),0) / submissions.length)
          : 0;

        setSummary({
          totalProgress: progress?.length || 0,
          completionRate: Math.round(completionRate),
          quizSubmissions: submissions?.length || 0,
          avgQuizScore: avgQuiz
        });

        const { data: qz, error: qErr } = await supabase.from('quizzes').select('id, title').order('id', { ascending: false }).limit(200);
        if (qErr) throw qErr;
        setQuizzes(qz || []);
      } catch (err) {
        setError(toUserMessage(err));
      }
    }
    load();
  }, [supabase]);

  const loadQuizAnalytics = async () => {
    setError('');
    setQuizAnalytics(null);
    try {
      const a = await getQuizAnalytics(selectedQuiz);
      setQuizAnalytics(a);
    } catch (e) {
      setError(toUserMessage(e));
    }
  };

  if (error) return <div className="container" style={{ padding: 24 }}><p style={{ color:'tomato' }}>{error}</p></div>;
  if (!summary) return <div className="container" style={{ padding: 24 }}>Loading analytics...</div>;

  return (
    <div className="container" style={{ padding: 24 }}>
      <h2>Analytics</h2>
      <p>Total progress records: {summary.totalProgress}</p>
      <p>Completion rate: {summary.completionRate}%</p>
      <p>Total quiz submissions: {summary.quizSubmissions}</p>
      <p>Average quiz score: {summary.avgQuizScore}%</p>

      <hr />
      <h3>Quiz Analytics</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={selectedQuiz} onChange={e=>setSelectedQuiz(e.target.value)}>
          <option value="">Select quiz</option>
          {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
        </select>
        <button onClick={loadQuizAnalytics} disabled={!selectedQuiz}>Load</button>
      </div>

      {quizAnalytics && (
        <div style={{ marginTop: 16 }}>
          <h4>Score Distribution</h4>
          <ul>
            {quizAnalytics.distribution.map(b => (
              <li key={b.range}>{b.range}%: {b.count}</li>
            ))}
          </ul>
          <h4>Item Analysis (difficulty)</h4>
          <ul>
            {quizAnalytics.perItem.map(it => (
              <li key={it.question_id}>
                Q {it.question_id}: difficulty {(it.difficulty * 100).toFixed(0)}% · correct {it.correct}/{it.total}
              </li>
            ))}
          </ul>
        </div>
      )}

      <small>Note: Role-based filters are enforced by RLS policies in Supabase.</small>
    </div>
  );
}
