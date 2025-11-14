import { getSupabaseClient } from '../lib/supabaseClient';
import { ApplicationError } from '../utils/errors';

const supabase = getSupabaseClient();

/**
 * INTERNAL: ensure user is authenticated.
 */
async function requireUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new ApplicationError(error.message || 'Auth error', 'AUTH', 401);
  if (!user) throw new ApplicationError('Not authenticated', 'AUTH', 401);
  return user;
}

// PUBLIC_INTERFACE
export async function createAssignment(payload) {
  /** Create quiz assignment for user, group (e.g., department), or lesson with optional windows and attempts.
   * payload: { quiz_id, assignee_type: 'user'|'group'|'lesson', assignee_id, due_at?, opens_at?, closes_at?, attempts_allowed?, created_by? }
   */
  try {
    const user = await requireUser();
    const record = {
      quiz_id: payload.quiz_id,
      assignee_type: payload.assignee_type,
      assignee_id: payload.assignee_id,
      due_at: payload.due_at || null,
      opens_at: payload.opens_at || null,
      closes_at: payload.closes_at || null,
      attempts_allowed: Number.isFinite(payload.attempts_allowed) ? payload.attempts_allowed : 1,
      created_by: payload.created_by || user.id,
    };
    const { error } = await supabase.from('quiz_assignments').insert(record);
    if (error) throw error;
    return true;
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to create assignment', 'ASSIGN_CREATE');
  }
}

// PUBLIC_INTERFACE
export async function listAssignments(filters = {}) {
  /** List assignments for admin/HR with optional filters: { quiz_id?, assignee_type? } */
  try {
    let query = supabase
      .from('quiz_assignments')
      .select('id, quiz_id, assignee_type, assignee_id, due_at, opens_at, closes_at, attempts_allowed, created_by')
      .order('due_at', { ascending: true })
      .limit(1000);
    if (filters.quiz_id) query = query.eq('quiz_id', filters.quiz_id);
    if (filters.assignee_type) query = query.eq('assignee_type', filters.assignee_type);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to list assignments', 'ASSIGN_LIST');
  }
}

// PUBLIC_INTERFACE
export async function revokeAssignment(id) {
  /** Revoke assignment by id (delete). */
  try {
    const { error } = await supabase.from('quiz_assignments').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to revoke assignment', 'ASSIGN_REVOKE');
  }
}

// PUBLIC_INTERFACE
export async function updateAssignment(id, patch) {
  /** Update due date or window and attempts. patch: { due_at?, opens_at?, closes_at?, attempts_allowed? } */
  try {
    const payload = {};
    if (patch.due_at !== undefined) payload.due_at = patch.due_at;
    if (patch.opens_at !== undefined) payload.opens_at = patch.opens_at;
    if (patch.closes_at !== undefined) payload.closes_at = patch.closes_at;
    if (patch.attempts_allowed !== undefined) payload.attempts_allowed = Number(patch.attempts_allowed);
    const { error } = await supabase.from('quiz_assignments').update(payload).eq('id', id);
    if (error) throw error;
    return true;
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to update assignment', 'ASSIGN_UPDATE');
  }
}

// PUBLIC_INTERFACE
export async function getActiveAssignmentForUser(quizId) {
  /** Resolve an active assignment for current user for quizId using RLS-aware helper view:
   * Expects a view: user_quiz_assignments_resolved(user_id, quiz_id, assignment_id, due_at, opens_at, closes_at, attempts_allowed)
   * that resolves direct user assignments, group/department, and lesson-based mappings.
   * Returns the first active assignment within window or null.
   */
  try {
    const user = await requireUser();
    const nowIso = new Date().toISOString();
    let query = supabase
      .from('user_quiz_assignments_resolved')
      .select('assignment_id, user_id, quiz_id, due_at, opens_at, closes_at, attempts_allowed')
      .eq('user_id', user.id)
      .eq('quiz_id', quizId)
      .order('due_at', { ascending: true })
      .limit(5);
    const { data, error } = await query;
    if (error) throw error;

    const active = (data || []).find(a => {
      const opensOk = !a.opens_at || new Date(a.opens_at).toISOString() <= nowIso;
      const closesOk = !a.closes_at || new Date(a.closes_at).toISOString() >= nowIso;
      return opensOk && closesOk;
    });
    return active || null;
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to resolve assignment', 'ASSIGN_RESOLVE');
  }
}

// PUBLIC_INTERFACE
export async function getAttemptsUsed(quizId) {
  /** Count attempts already submitted by current user for the quiz (status submitted). */
  try {
    const user = await requireUser();
    const { count, error } = await supabase
      .from('quiz_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_id', quizId)
      .eq('user_id', user.id)
      .eq('status', 'submitted');
    if (error) throw error;
    return count || 0;
  } catch (e) {
    throw new ApplicationError(e.message || 'Failed to count attempts', 'ASSIGN_ATTEMPTS');
  }
}
