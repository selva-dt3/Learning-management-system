# Supabase LMS SQL Execution Runbook

This runbook executes the idempotent SQL for the LMS schema, RLS, views, and storage policies, and verifies that:
- No syntax errors occur
- Policies on storage.objects are created when missing and skipped when existing on re-run
- Public.* policies are re-created cleanly on re-run (using DROP POLICY IF EXISTS)

Prerequisites:
- Supabase project with access
- One of:
  - Supabase SQL Editor (web console), OR
  - Supabase CLI + psql installed and authenticated

Files:
- assets/supabase_setup.sql (executable version of kavia-docs/supabase-lms-setup.md)

Option A: Supabase SQL Editor (recommended)
1) Open your project's SQL editor
2) Paste the contents of assets/supabase_setup.sql and Run
3) Run again to verify idempotency

Option B: Supabase CLI (with credentials)
1) Install CLI: https://supabase.com/docs/guides/cli
2) Login and link project:
   supabase login
   supabase link --project-ref <YOUR_PROJECT_REF>
3) Get a psql connection (CLI prints a URI):
   supabase db connect
4) Execute:
   psql "<DATABASE_URL_FROM_STEP3>" -v ON_ERROR_STOP=1 -f assets/supabase_setup.sql
5) Execute again to verify idempotency.

Verification queries (run in SQL editor):
- Check storage policies created once:
  select polname from pg_policies p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname='storage' and c.relname='objects' and polname like 'lesson-files%';

- Tables exist:
  select table_name from information_schema.tables where table_schema='public'
  and table_name in ('profiles','lessons','lesson_assignments','lesson_progress','onboarding_status',
                     'quizzes','quiz_questions','quiz_answers','quiz_submissions','quiz_submission_items',
                     'question_bank','question_bank_answers','quiz_assignments','user_invitations');

- Views exist:
  select table_name from information_schema.views where table_schema='public'
  and table_name in ('quiz_submission_items_with_question','quiz_assignments_view','user_quiz_assignments_resolved');

- Functions exist:
  select routine_name from information_schema.routines where specific_schema='public'
  and routine_name in ('current_app_role','set_updated_at','handle_new_user',
                       'get_user_quiz_assignments_resolved','has_active_assignment');

Expected results on second run:
- No syntax errors
- No duplicate policy errors
- Storage policy DO $$ blocks skip creation if policy exists

Notes:
- Ensure Realtime is enabled for lessons and lesson_progress in the Supabase dashboard.
- Confirm a non-public storage bucket 'lesson-files' is created under Storage.
