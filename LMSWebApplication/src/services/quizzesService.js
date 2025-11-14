import { getSupabaseClient } from '../lib/supabaseClient';
import { ApplicationError } from '../utils/errors';

const supabase = getSupabaseClient();

/**
 * PUBLIC_INTERFACE
 * Create or update a quiz with questions and answers (MCQ/TrueFalse).
 * quiz: { id?, title, description }
 * questions: [{ id?, text, type: 'MCQ'|'TRUE_FALSE', options?: [text], correctIndex?: number, correctBoolean?: boolean }]
 */
export async function upsertQuizWithQuestions(quiz, questions) {
  try {
    let quizId = quiz.id;
    if (!quizId) {
      const { data, error } = await supabase
        .from('quizzes')
        .insert({
          title: quiz.title,
          description: quiz.description || null,
        })
        .select('id')
        .single();
      if (error) throw error;
      quizId = data.id;
    } else {
      const { error } = await supabase
        .from('quizzes')
        .update({
          title: quiz.title,
          description: quiz.description || null,
        })
        .eq('id', quizId);
      if (error) throw error;
    }

    // Upsert questions and answers
    for (const q of questions) {
      let qId = q.id;
      if (!qId) {
        const { data, error } = await supabase
          .from('quiz_questions')
          .insert({
            quiz_id: quizId,
            text: q.text,
            type: q.type,
          })
          .select('id')
          .single();
        if (error) throw error;
        qId = data.id;
      } else {
        const { error } = await supabase
          .from('quiz_questions')
          .update({ text: q.text, type: q.type })
          .eq('id', qId);
        if (error) throw error;
      }

      // Manage answers
      if (q.type === 'MCQ') {
        await supabase.from('quiz_answers').delete().eq('question_id', qId);
        const options = q.options || [];
        for (let idx = 0; idx < options.length; idx++) {
          const text = options[idx];
          const { error } = await supabase.from('quiz_answers').insert({
            question_id: qId,
            text,
            is_correct: q.correctIndex === idx,
          });
          if (error) throw error;
        }
      } else if (q.type === 'TRUE_FALSE') {
        await supabase.from('quiz_answers').delete().eq('question_id', qId);
        const { error } = await supabase.from('quiz_answers').insert({
          question_id: qId,
          text: q.correctBoolean ? 'True' : 'False',
          is_correct: true,
        });
        if (error) throw error;
      }
    }

    return quizId;
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to save quiz', 'QUIZ_UPSERT');
  }
}

/**
 * PUBLIC_INTERFACE
 * Fetch quiz with questions and options.
 */
export async function getQuiz(quizId) {
  const { data: quiz, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .single();
  if (error) throw new ApplicationError(error.message, 'QUIZ_GET');

  const { data: q, error: qErr } = await supabase
    .from('quiz_questions')
    .select('id, text, type')
    .eq('quiz_id', quizId)
    .order('id');
  if (qErr) throw new ApplicationError(qErr.message, 'QUIZ_QUESTIONS');

  const questions = [];
  for (const row of q || []) {
    const { data: answers, error: aErr } = await supabase
      .from('quiz_answers')
      .select('id, text, is_correct')
      .eq('question_id', row.id)
      .order('id');
    if (aErr) throw new ApplicationError(aErr.message, 'QUIZ_ANSWERS');
    questions.push({
      ...row,
      options: answers?.map((a) => a.text) || [],
      correctIndex: answers?.findIndex((a) => a.is_correct) ?? -1,
      correctBoolean: answers?.[0]?.text === 'True',
    });
  }
  return { quiz, questions };
}

/**
 * PUBLIC_INTERFACE
 * Submit quiz answers and return score result.
 * answers: [{ question_id, answer_text? , boolean? }]
 */
export async function submitQuiz(quizId, answers) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApplicationError('Not authenticated', 'AUTH', 401);

    // fetch correct answers
    const { data: ans, error: aErr } = await supabase
      .from('quiz_answers')
      .select('question_id, text, is_correct')
      .in('question_id', answers.map((a) => a.question_id));
    if (aErr) throw aErr;

    let correct = 0;
    for (const provided of answers) {
      const correctForQ = (ans || []).filter(
        (a) => a.question_id === provided.question_id && a.is_correct
      );
      if (provided.boolean !== undefined) {
        const isTrue = provided.boolean ? 'True' : 'False';
        if (correctForQ.some((a) => a.text === isTrue)) correct++;
      } else if (provided.answer_text) {
        if (correctForQ.some((a) => a.text === provided.answer_text)) correct++;
      }
    }
    const total = answers.length;
    const score = total ? Math.round((correct / total) * 100) : 0;

    const { error: subErr } = await supabase.from('quiz_submissions').insert({
      quiz_id: quizId,
      user_id: user.id,
      score,
      submitted_at: new Date().toISOString(),
      details: answers,
    });
    if (subErr) throw subErr;

    return { score, correct, total };
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to submit quiz', 'QUIZ_SUBMIT');
  }
}
