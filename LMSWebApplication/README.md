# LMS Web Application (React + Supabase)

This app is a frontend-driven Corporate LMS using React and Supabase JavaScript APIs. It supports roles (Admin, HR, Employee), lessons with storage (PDF/video), quizzes, onboarding, analytics, and real-time updates.

## Setup

1) Install dependencies:
```
npm install
```

2) Configure environment:
- Copy `.env.example` to `.env` and set:
  - `REACT_APP_SUPABASE_URL`
  - `REACT_APP_SUPABASE_ANON_KEY`
  - Optional: `REACT_APP_SITE_URL` (defaults to window.location.origin)

Note: Other env vars are present in the container environment.

3) Start the app:
```
npm start
```

## Supabase Tables (Quiz Feature Expectations)

- profiles(user_id uuid, role text ['Admin','HR','Employee'], full_name text, department text, email text)
- lessons(id uuid, title text, description text, status text ['draft','published'], storage_path text, updated_at timestamp)
- lesson_assignments(user_id uuid, lesson_id uuid)

- quizzes(id uuid default gen_random_uuid(), title text, description text, shuffle bool, time_limit_sec int)
- quiz_questions(id uuid default gen_random_uuid(), quiz_id uuid, text text, type text ['MCQ','TRUE_FALSE'], points int default 1, explanation text)
- quiz_answers(id uuid default gen_random_uuid(), question_id uuid, text text, is_correct bool)

- quiz_submissions(id uuid default gen_random_uuid(), quiz_id uuid, user_id uuid, score int, submitted_at timestamp, details jsonb, status text default 'submitted')
- quiz_submission_items(id uuid default gen_random_uuid(), submission_id uuid, question_id uuid, is_correct bool, points int, earned int, selected text, correct text)

- question_bank(id uuid default gen_random_uuid(), text text, type text ['MCQ','TRUE_FALSE'], points int default 1, explanation text)
- question_bank_answers(id uuid default gen_random_uuid(), question_id uuid, text text, is_correct bool)

- quiz_assignments(id uuid default gen_random_uuid(), quiz_id uuid, lesson_id uuid null, user_id uuid null, group_id uuid null, due_date date, assigned_at timestamp)

Optional helpful views:
- quiz_assignments_view(user_id uuid, quiz_id uuid, quiz_title text, due_date date, lesson_id uuid)
- quiz_submission_items_with_question(submission_id uuid, question_id uuid, question_text text, is_correct bool)

Storage bucket: `lesson-files` (use signed URLs for viewing).

## RLS Policy Notes

- profiles: users select/update own row (user_id = auth.uid()); Admin/HR broader as required.
- lessons: Admin CRUD; others select published or assigned via lesson_assignments; realtime enabled.
- lesson_progress: owner upsert/select; Admin/HR read for analytics.
- quizzes/questions/answers: Admin/HR CRUD; Employees select assigned/available quizzes.
- quiz_submissions: owner insert/select; Admin/HR select for analytics/reviews.
- quiz_submission_items: owner select of their submission items; Admin/HR select for reviews.
- question_bank: Admin/HR CRUD; Employees read-only (optional).
- quiz_assignments: Admin/HR insert/select/delete; users select rows where user_id = auth.uid() or mapped via group membership.

Ensure RLS policies align with the above UI behaviors for a seamless experience.

## Implemented Features

- Auth: Email/password sign up/in/out, password reset email. Profile row upserted/synced with role metadata.
- Role-based dashboards and guarded routes.
- Lessons: List with realtime updates, create/edit/delete, storage uploader (PDF/MP4/WebM) with validation, signed URLs in viewer, mark-complete.
- Quizzes:
  - Quiz Builder: MCQ/True-False; per-question points and explanations; optional shuffle & time limit.
  - Question Bank: CRUD reusable questions; add to quizzes.
  - Assignments: Service-level method to assign quizzes to lessons/users/groups (UI wiring optional).
  - Taking Flow: one-by-one or all-at-once; validation; optional timer; duplicate submission prevention.
  - Grading: Auto-grades MCQ/TF; per-question scoring; stores detailed results in quiz_submission_items.
  - Reviews: Learner post-submit review; Admin/HR reviews list and attempt detail; status update (reopen/invalidate).
  - Analytics: Score distribution and item difficulty approximation.
- Onboarding: NDA/Code of Conduct acknowledgments stored via upsert.
- Realtime: Lessons and progress channels wired for auto-refresh.

## Troubleshooting
- Ensure Supabase env vars are correctly set in `.env`. Client will log a clear error if missing.
- Confirm storage bucket `lesson-files` exists and policies permit authenticated uploads and signed URL creation.
- Verify RLS policies and tables for quizzes match schema above (see assets/supabase.md).

## Learn More
Standard CRA documentation applies.
