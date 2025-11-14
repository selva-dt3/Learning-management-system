# Supabase Integration Notes

- Auth: Uses `@supabase/supabase-js` v2 client configured via:
  - REACT_APP_SUPABASE_URL
  - REACT_APP_SUPABASE_ANON_KEY
- Email redirect: Uses REACT_APP_SITE_URL (default window.location.origin) for `emailRedirectTo` on sign up and password reset.
- Never hardcode secrets; all configuration is via environment variables.

## Tables and Policies

Core:
- profiles: { id serial, user_id uuid (unique), role text, full_name text, department text, email text }
  - Policy: user can select/update their own row (user_id = auth.uid()); Admin/HR may select broader as per compliance.
- lessons: { id uuid default gen_random_uuid(), title text, description text, status text ['draft','published'], storage_path text, updated_at timestamp default now() }
  - Policies: Admin can CRUD; others select published or assigned via lesson_assignments.
- lesson_assignments: { user_id uuid, lesson_id uuid, assigned_at timestamp, primary key (user_id, lesson_id) }
  - Policies: Admin/HR can insert/delete; users can select own.
- lesson_progress: { user_id uuid, lesson_id uuid, completed bool, completed_at timestamp, primary key (user_id, lesson_id) }
  - Policy: owner upsert/select; Admin/HR select for analytics.
- onboarding_status: { user_id uuid pk, nda_signed bool, coc_signed bool, acknowledged_at timestamp }
  - Policies: owner upsert/select; HR/Admin select/report.

Quizzes:
- quizzes: { id uuid default gen_random_uuid(), title text, description text, shuffle bool, time_limit_sec int }
  - Policies: Admin/HR CRUD; Employees select assigned/available per assignment.
- quiz_questions: { id uuid default gen_random_uuid(), quiz_id uuid, text text, type text ['MCQ','TRUE_FALSE'], points int default 1, explanation text }
- quiz_answers: { id uuid default gen_random_uuid(), question_id uuid, text text, is_correct bool }

Submissions:
- quiz_submissions: { id uuid default gen_random_uuid(), quiz_id uuid, user_id uuid, score int, submitted_at timestamp, details jsonb, status text default 'submitted' }
  - Policies: owner insert/select; Admin/HR select for analytics and reviews.
- quiz_submission_items: { id uuid default gen_random_uuid(), submission_id uuid, question_id uuid, is_correct bool, points int, earned int, selected text, correct text }
  - Policies: owner select on rows where submission_id belongs to auth.uid(); Admin/HR select for reviews.

Question Bank:
- question_bank: { id uuid default gen_random_uuid(), text text, type text ['MCQ','TRUE_FALSE'], points int default 1, explanation text }
  - Policies: Admin/HR CRUD; Employees read-only (optional).
- question_bank_answers: { id uuid default gen_random_uuid(), question_id uuid, text text, is_correct bool }

Assignments:
- quiz_assignments: { id uuid default gen_random_uuid(), quiz_id uuid, lesson_id uuid null, user_id uuid null, group_id uuid null, due_date date, assigned_at timestamp }
  - Policies: Admin/HR insert/select/delete; users select where user_id = auth.uid() or via group membership view.

Optional Views (for convenience):
- quiz_assignments_view(user_id uuid, quiz_id uuid, quiz_title text, due_date date, lesson_id uuid)
- quiz_submission_items_with_question(submission_id uuid, question_id uuid, question_text text, is_correct bool)

## Real-time
- Realtime enabled on: lessons, lesson_progress (and optionally quiz_submissions).
- UI subscribes to lessons and lesson_progress changes to auto-refresh lists.
- Quizzes/reviews can opt-in to realtime if desired.

## Notes
- Ensure RLS policies align with UI behaviors for a seamless experience.
- The app prevents duplicate submissions per quiz per user by checking `quiz_submissions` unless assignment allows multiple attempts (extend policy/columns if needed).
- Use signed URLs for lesson content; uploads validated client-side (type/size).
