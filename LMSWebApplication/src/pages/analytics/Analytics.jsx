import React, { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { toUserMessage } from '../../utils/errors';

export default function Analytics() {
  const supabase = getSupabaseClient();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

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
      } catch (err) {
        setError(toUserMessage(err));
      }
    }
    load();
  }, [supabase]);

  if (error) return <div className="container" style={{ padding: 24 }}><p style={{ color:'tomato' }}>{error}</p></div>;
  if (!summary) return <div className="container" style={{ padding: 24 }}>Loading analytics...</div>;

  return (
    <div className="container" style={{ padding: 24 }}>
      <h2>Analytics</h2>
      <p>Total progress records: {summary.totalProgress}</p>
      <p>Completion rate: {summary.completionRate}%</p>
      <p>Total quiz submissions: {summary.quizSubmissions}</p>
      <p>Average quiz score: {summary.avgQuizScore}%</p>
      <small>Note: Role-based filters are enforced by RLS policies in Supabase.</small>
    </div>
  );
}
