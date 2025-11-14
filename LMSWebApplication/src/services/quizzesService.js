import { getSupabaseClient } from '../lib/supabaseClient';
import { ApplicationError } from '../utils/errors';

/**
 * INTERNAL: Helper to assert authentication and return current user.
 */
async function requireUser() {
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new ApplicationError(error.message || 'Auth error', 'AUTH', 401);
  if (!user) throw new ApplicationError('Not authenticated', 'AUTH', 401);
  return user;
}

/**
 * PUBLIC_INTERFACE
 * Create or update a quiz with questions and answers (MCQ/TRUE_FALSE).
 * Supports per-question points and optional metadata: shuffle, time_limit_sec.
 * quiz: { id?, title, description, shuffle?: boolean, time_limit_sec?: number }
 * questions: [{ id?, text, type: 'MCQ'|'TRUE_FALSE', options?: [text], correctIndex?: number, correctBoolean?: boolean, points?: number, explanation?: string }]
 */
export async function upsertQuizWithQuestions(quiz, questions) {
  try {
    const supabase = getSupabaseClient();
    // Upsert quiz core
    let quizId = quiz.id;
    const quizPayload = {
      title: quiz.title,
      description: quiz.description || null,
      shuffle: !!quiz.shuffle,
      time_limit_sec: quiz.time_limit_sec ?? null,
    };
    if (!quizId) {
      const { data, error } = await supabase
        .from('quizzes')
        .insert(quizPayload)
        .select('id')
        .single();
      if (error) throw error;
      quizId = data.id;
    } else {
      const { error } = await supabase.from('quizzes').update(quizPayload).eq('id', quizId);
      if (error) throw error;
    }

    // Upsert questions and answers
    for (const q of questions) {
      const qPayload = {
        quiz_id: quizId,
        text: q.text,
        type: q.type,
        points: Number.isFinite(q.points) ? q.points : 1,
        explanation: q.explanation || null,
      };
      let qId = q.id;
      if (!qId) {
        const { data, error } = await supabase
          .from('quiz_questions')
          .insert(qPayload)
          .select('id')
          .single();
        if (error) throw error;
        qId = data.id;
      } else {
        const { error } = await supabase.from('quiz_questions').update(qPayload).eq('id', qId);
        if (error) throw error;
      }

      // Answers
      await supabase.from('quiz_answers').delete().eq('question_id', qId);
      if (q.type === 'MCQ') {
        const options = q.options || [];
        for (let idx = 0; idx < options.length; idx++) {
          const text = options[idx];
          if (typeof text !== 'string' || !text.trim()) continue;
          const { error } = await supabase.from('quiz_answers').insert({
            question_id: qId,
            text: text.trim(),
            is_correct: q.correctIndex === idx,
          });
          if (error) throw error;
        }
      } else if (q.type === 'TRUE_FALSE') {
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
 * CRUD for Question Bank (standalone questions reusable across quizzes).
 * question: { id?, text, type, options?, correctIndex?, correctBoolean?, points?, explanation? }
 */
export async function upsertBankQuestion(question) {
  try {
    const supabase = getSupabaseClient();
    let qId = question.id;
    const payload = {
      text: question.text,
      type: question.type,
      points: Number.isFinite(question.points) ? question.points : 1,
      explanation: question.explanation || null,
    };
    if (!qId) {
      const { data, error } = await supabase.from('question_bank').insert(payload).select('id').single();
      if (error) throw error;
      qId = data.id;
    } else {
      const { error } = await supabase.from('question_bank').update(payload).eq('id', qId);
      if (error) throw error;
    }
    // answers
    await supabase.from('question_bank_answers').delete().eq('question_id', qId);
    if (question.type === 'MCQ') {
      for (let i = 0; i < (question.options || []).length; i++) {
        const text = question.options[i];
        if (!text?.trim()) continue;
        const { error } = await supabase.from('question_bank_answers').insert({
          question_id: qId,
          text: text.trim(),
          is_correct: question.correctIndex === i,
        });
        if (error) throw error;
      }
    } else if (question.type === 'TRUE_FALSE') {
      const { error } = await supabase.from('question_bank_answers').insert({
        question_id: qId,
        text: question.correctBoolean ? 'True' : 'False',
        is_correct: true,
      });
      if (error) throw error;
    }
    return qId;
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to upsert bank question', 'BANK_UPSERT');
  }
}

/**
 * PUBLIC_INTERFACE
 * Delete a question from the bank.
 */
export async function deleteBankQuestion(questionId) {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('question_bank').delete().eq('id', questionId);
    if (error) throw error;
    return true;
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to delete bank question', 'BANK_DELETE');
  }
}

/**
 * PUBLIC_INTERFACE
 * List question bank questions (RLS-aware).
 */
export async function listBankQuestions(limit = 200, search = '') {
  try {
    const supabase = getSupabaseClient();
    let query = supabase.from('question_bank').select('id, text, type, points, explanation').order('id', { ascending: false }).limit(limit);
    if (search?.trim()) {
      query = query.ilike('text', `%${search.trim()}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to fetch bank questions', 'BANK_LIST');
  }
}

/**
 * PUBLIC_INTERFACE
 * Add bank question to a quiz (creates quiz_questions and quiz_answers from bank copy).
 */
export async function addBankQuestionToQuiz(quizId, bankQuestionId) {
  try {
    const supabase = getSupabaseClient();
    const { data: q, error } = await supabase.from('question_bank').select('id, text, type, points, explanation').eq('id', bankQuestionId).single();
    if (error) throw error;
    const { data: answers, error: aErr } = await supabase.from('question_bank_answers').select('text, is_correct').eq('question_id', bankQuestionId);
    if (aErr) throw aErr;

    const { data: newQ, error: iErr } = await supabase
      .from('quiz_questions')
      .insert({ quiz_id: quizId, text: q.text, type: q.type, points: q.points, explanation: q.explanation })
      .select('id')
      .single();
    if (iErr) throw iErr;

    for (const a of answers || []) {
      const { error: iaErr } = await supabase.from('quiz_answers').insert({ question_id: newQ.id, text: a.text, is_correct: a.is_correct });
      if (iaErr) throw iaErr;
    }
    return newQ.id;
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to add bank question', 'BANK_ADD_TO_QUIZ');
  }
}

/**
 * PUBLIC_INTERFACE
 * Fetch quiz with questions and options. Supports optional shuffle.
 */
export async function getQuiz(quizId) {
  const supabase = getSupabaseClient();
  const { data: quiz, error } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
  if (error) throw new ApplicationError(error.message, 'QUIZ_GET');

  const { data: q, error: qErr } = await supabase
    .from('quiz_questions')
    .select('id, text, type, points, explanation')
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
    const qRec = {
      ...row,
      options: answers?.map((a) => a.text) || [],
      correctIndex: (answers || []).findIndex((a) => a.is_correct),
      correctBoolean: answers?.[0]?.text === 'True',
    };
    questions.push(qRec);
  }

  // shuffle if enabled (pure front-end)
  if (quiz.shuffle) {
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
  }

  return { quiz, questions };
}

/**
 * INTERNAL: compute grading for provided answers and return detailed per-item results.
 * providedAnswers: [{ question_id, answer_text?, boolean? }]
 * returns: { totalPoints, earnedPoints, items: [{ question_id, is_correct, points, earned, selected, correct, explanation }] }
 */
async function gradeAnswers(quizId, providedAnswers) {
  const supabase = getSupabaseClient();
  const qIds = providedAnswers.map(a => a.question_id);
  const { data: qRows, error: qErr } = await supabase.from('quiz_questions').select('id, points, explanation, type').in('id', qIds);
  if (qErr) throw qErr;
  const { data: aRows, error: aErr } = await supabase.from('quiz_answers').select('question_id, text, is_correct').in('question_id', qIds);
  if (aErr) throw aErr;

  let totalPoints = 0;
  let earnedPoints = 0;
  const items = [];

  for (const provided of providedAnswers) {
    const qInfo = (qRows || []).find(q => q.id === provided.question_id);
    const qPoints = Number.isFinite(qInfo?.points) ? qInfo.points : 1;
    totalPoints += qPoints;

    const correctForQ = (aRows || []).filter(a => a.question_id === provided.question_id && a.is_correct);
    const allForQ = (aRows || []).filter(a => a.question_id === provided.question_id);

    let isCorrect = false;
    let selected = null;
    let correct = null;

    if (provided.boolean !== undefined) {
      const sel = provided.boolean ? 'True' : 'False';
      selected = sel;
      correct = correctForQ[0]?.text || null;
      isCorrect = correctForQ.some(a => a.text === sel);
    } else if (provided.answer_text) {
      selected = provided.answer_text;
      correct = correctForQ[0]?.text || null;
      isCorrect = correctForQ.some(a => a.text === provided.answer_text);
    } else {
      // unanswered
      selected = null;
      correct = correctForQ[0]?.text || (allForQ.find(a=>a.is_correct)?.text || null);
      isCorrect = false;
    }

    const earned = isCorrect ? qPoints : 0;
    earnedPoints += earned;
    items.push({
      question_id: provided.question_id,
      is_correct: isCorrect,
      points: qPoints,
      earned,
      selected,
      correct,
      explanation: qInfo?.explanation || null,
      type: qInfo?.type || null
    });
  }

  return { totalPoints, earnedPoints, items };
}

/**
 * PUBLIC_INTERFACE
 * Submit quiz answers (UI enforces active assignment, window, and attempts).
 * Prevents duplicate submissions per (quiz_id, user_id) unless allowMultiple is true (based on assignment attempts).
 * answers: [{ question_id, answer_text? , boolean? }]
 * Returns: { scorePercent, totalPoints, earnedPoints, items }
 */
export async function submitQuiz(quizId, answers, options = {}) {
  try {
    const user = await requireUser();

    // Check prior submission (single-attempt enforcement)
    if (!options.allowMultiple) {
      const { data: prior, error: priorErr } = await supabase
        .from('quiz_submissions')
        .select('id')
        .eq('quiz_id', quizId)
        .eq('user_id', user.id)
        .limit(1);
      if (priorErr) throw priorErr;
      if ((prior || []).length > 0) {
        throw new ApplicationError('You have already submitted this quiz.', 'QUIZ_DUPLICATE', 400);
      }
    }

    // Grade
    const supabase = getSupabaseClient();
    const grading = await gradeAnswers(quizId, answers);
    const scorePercent = grading.totalPoints ? Math.round((grading.earnedPoints / grading.totalPoints) * 100) : 0;

    // Store submission
    const { data: sub, error: subErr } = await supabase
      .from('quiz_submissions')
      .insert({
        quiz_id: quizId,
        user_id: user.id,
        score: scorePercent,
        submitted_at: new Date().toISOString(),
        details: answers, // legacy details; per-item are stored separately
        status: 'submitted',
      })
      .select('id')
      .single();
    if (subErr) throw subErr;

    // Store per-question items
    for (const item of grading.items) {
      const { error: itemErr } = await supabase.from('quiz_submission_items').insert({
        submission_id: sub.id,
        question_id: item.question_id,
        is_correct: item.is_correct,
        points: item.points,
        earned: item.earned,
        selected: item.selected,
        correct: item.correct,
      });
      if (itemErr) throw itemErr;
    }

    return { scorePercent, totalPoints: grading.totalPoints, earnedPoints: grading.earnedPoints, items: grading.items, submission_id: sub.id };
  } catch (e) {
    if (e instanceof ApplicationError) throw e;
    throw new ApplicationError(e.message || 'Failed to submit quiz', 'QUIZ_SUBMIT');
  }
}

/**
 * PUBLIC_INTERFACE
 * Fetch a user's submission summary list for a quiz (RLS-aware).
 */
export async function listSubmissions(quizId, userIdOpt = null) {
  try {
    const supabase = getSupabaseClient();
    let query = supabase
      .from('quiz_submissions')
      .select('id, user_id, score, submitted_at, status')
      .eq('quiz_id', quizId)
      .order('submitted_at', { ascending: false })
      .limit(1000);
    if (userIdOpt) query = query.eq('user_id', userIdOpt);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to list submissions', 'QUIZ_LIST_SUB');
  }
}

/**
 * PUBLIC_INTERFACE
 * Get detailed submission including per-item results.
 */
export async function getSubmissionDetail(submissionId) {
  try {
    const supabase = getSupabaseClient();
    const { data: sub, error } = await supabase
      .from('quiz_submissions')
      .select('id, quiz_id, user_id, score, submitted_at, status')
      .eq('id', submissionId)
      .single();
    if (error) throw error;

    const { data: items, error: iErr } = await supabase
      .from('quiz_submission_items')
      .select('id, question_id, is_correct, points, earned, selected, correct')
      .eq('submission_id', submissionId);
    if (iErr) throw iErr;

    // Optionally include question text
    const ids = (items || []).map(i => i.question_id);
    const { data: qRows, error: qErr } = await supabase.from('quiz_questions').select('id, text, explanation, type').in('id', ids);
    if (qErr) throw qErr;

    const detailedItems = (items || []).map(it => ({
      ...it,
      question: qRows?.find(q => q.id === it.question_id) || null,
    }));

    return { submission: sub, items: detailedItems };
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to get submission detail', 'QUIZ_GET_SUB');
  }
}

/**
 * PUBLIC_INTERFACE
 * Admin/HR: Re-open or invalidate a submission (status changes).
 */
export async function updateSubmissionStatus(submissionId, status) {
  try {
    const supabase = getSupabaseClient();
    const allowed = ['submitted', 'reopened', 'invalidated'];
    if (!allowed.includes(status)) throw new ApplicationError('Invalid status', 'QUIZ_STATUS', 400);
    const { error } = await supabase.from('quiz_submissions').update({ status }).eq('id', submissionId);
    if (error) throw error;
    return true;
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to update submission status', 'QUIZ_UPDATE_STATUS');
  }
}

/**
 * PUBLIC_INTERFACE
 * Assign a quiz to a lesson or users/groups. Uses assignment tables.
 * assignment: { quiz_id, lesson_id?, user_id?, group_id?, due_date? }
 */
export async function assignQuiz(assignment) {
  try {
    const supabase = getSupabaseClient();
    const payload = {
      quiz_id: assignment.quiz_id,
      lesson_id: assignment.lesson_id || null,
      user_id: assignment.user_id || null,
      group_id: assignment.group_id || null,
      due_date: assignment.due_date || null,
      assigned_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('quiz_assignments').insert(payload);
    if (error) throw error;
    return true;
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to assign quiz', 'QUIZ_ASSIGN');
  }
}

/**
 * PUBLIC_INTERFACE
 * Get assigned quizzes for current user (RLS-aware).
 */
export async function getMyAssignedQuizzes() {
  try {
    const supabase = getSupabaseClient();
    const user = await requireUser();
    const { data, error } = await supabase
      .from('quiz_assignments_view')
      .select('quiz_id, quiz_title, due_date, lesson_id')
      .eq('user_id', user.id)
      .order('due_date', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to fetch assigned quizzes', 'QUIZ_MY_ASSIGN');
  }
}

/**
 * PUBLIC_INTERFACE
 * Analytics helpers: score distribution and basic item analysis (difficulty).
 */
export async function getQuizAnalytics(quizId) {
  try {
    const supabase = getSupabaseClient();
    const { data: subs, error } = await supabase
      .from('quiz_submissions')
      .select('id, score')
      .eq('quiz_id', quizId)
      .eq('status', 'submitted')
      .limit(5000);
    if (error) throw error;

    const distribution = [0,10,20,30,40,50,60,70,80,90,100].map((b, idx, arr) => {
      const upper = arr[idx+1] ?? 101;
      const count = (subs || []).filter(s => s.score >= b && s.score < upper).length;
      return { range: `${b}-${upper-1}`, count };
    });

    // Item analysis via submission_items
    const { data: items, error: iErr } = await supabase
      .from('quiz_submission_items_with_question') // view suggested (join items+questions)
      .select('question_id, question_text, is_correct');
    // Fallback if view not present
    let perItem = [];
    if (iErr) {
      const { data: pureItems, error: pErr } = await supabase
        .from('quiz_submission_items')
        .select('question_id, is_correct');
      if (pErr) throw pErr;
      const counts = {};
      for (const it of (pureItems || [])) {
        counts[it.question_id] = counts[it.question_id] || { total: 0, correct: 0 };
        counts[it.question_id].total += 1;
        counts[it.question_id].correct += it.is_correct ? 1 : 0;
      }
      perItem = Object.entries(counts).map(([qid, v]) => ({
        question_id: qid,
        difficulty: v.total ? 1 - (v.correct / v.total) : 0, // higher = harder
        total: v.total,
        correct: v.correct,
      }));
    } else {
      const map = {};
      for (const it of items || []) {
        const o = map[it.question_id] || { question_id: it.question_id, question_text: it.question_text, total: 0, correct: 0 };
        o.total += 1;
        o.correct += it.is_correct ? 1 : 0;
        map[it.question_id] = o;
      }
      perItem = Object.values(map).map(o => ({
        ...o,
        difficulty: o.total ? 1 - (o.correct / o.total) : 0,
      }));
    }

    return { distribution, perItem };
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to load quiz analytics', 'QUIZ_ANALYTICS');
  }
}
