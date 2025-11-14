import { getSupabaseClient } from '../lib/supabaseClient';
import { ApplicationError } from '../utils/errors';

const supabase = getSupabaseClient();

// PUBLIC_INTERFACE
export async function markLessonComplete(lessonId) {
  /** Mark a lesson as completed for current user using RLS */
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApplicationError('Not authenticated', 'AUTH', 401);
    const { error } = await supabase.from('lesson_progress').upsert({
      user_id: user.id,
      lesson_id: lessonId,
      completed: true,
      completed_at: new Date().toISOString()
    }, { onConflict: 'user_id,lesson_id' });
    if (error) throw error;
    return true;
  } catch (e) {
    throw new ApplicationError(e.message || 'Unable to mark complete', 'LESSON_PROGRESS');
  }
}
