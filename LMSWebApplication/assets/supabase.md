# Supabase Integration Notes

- Auth: Uses `@supabase/supabase-js` v2 client configured via:
  - REACT_APP_SUPABASE_URL
  - REACT_APP_SUPABASE_ANON_KEY
- Email redirect: Uses REACT_APP_SITE_URL (default window.location.origin) for `emailRedirectTo` on sign up and password reset.

## Tables and Policies
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
- quizzes: { id uuid, title text, description text }
- quiz_questions: { id uuid, quiz_id uuid, text text, type text ['MCQ','TRUE_FALSE'] }
- quiz_answers: { id uuid, question_id uuid, text text, is_correct bool }
- quiz_submissions: { id uuid, quiz_id uuid, user_id uuid, score int, submitted_at timestamp, details jsonb }
  - Policy: owner insert/select; Admin/HR select for analytics.

## Storage
- Bucket: `lesson-files`
  - Uploads from the UI validate file type (PDF/MP4/WebM) and size (<=50MB).
  - Store storage_path as `lesson-files/path/to/file.ext`. UI requests signed URL for view.

## Real-time
- Realtime enabled on: lessons, lesson_progress (and optionally quiz_submissions).
- UI subscribes to lessons and lesson_progress changes to auto-refresh lists.

Ensure RLS policies align with the above UI behaviors for a seamless experience.
