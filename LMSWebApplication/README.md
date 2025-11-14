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

## Supabase Notes

- Tables referenced by the UI:
  - profiles(user_id uuid, role text ['Admin','HR','Employee'], full_name text, department text, email text)
  - lessons(id uuid, title text, description text, status text ['draft','published'], storage_path text, updated_at timestamp)
  - lesson_assignments(user_id uuid, lesson_id uuid)
  - lesson_progress(user_id uuid, lesson_id uuid, completed bool, completed_at timestamp)
  - quizzes(id uuid, title text, description text)
  - quiz_questions(id uuid, quiz_id uuid, text text, type text ['MCQ','TRUE_FALSE'])
  - quiz_answers(id uuid, question_id uuid, text text, is_correct bool)
  - quiz_submissions(id uuid, quiz_id uuid, user_id uuid, score int, submitted_at timestamp, details jsonb)
  - onboarding_status(user_id uuid pk, nda_signed bool, coc_signed bool, acknowledged_at timestamp)
- Storage bucket: `lesson-files` (use signed URLs for viewing).
- RLS policies must allow:
  - profiles: users can select/update their row (user_id = auth.uid()); Admin/HR broader as required.
  - lessons: Admin CRUD; others select published/assigned; realtime enabled.
  - lesson_progress: owner upsert/select own; Admin/HR read for analytics.
  - quiz_submissions: owner insert/select; Admin/HR read for reporting.
  - onboarding_status: owner upsert/select; HR/Admin read.

## Implemented Features

- Auth: Email/password sign up/in/out, password reset email. Profile row upserted/synced with role metadata.
- Role-based dashboards and guarded routes.
- Lessons: List with realtime updates, create/edit/delete, storage uploader (PDF/MP4/WebM) with validation, signed URLs in viewer, mark-complete.
- Quizzes: Builder for MCQ and True/False, taker to load quiz, select answers, submit and grade (stores score + details).
- Onboarding: NDA/Code of Conduct acknowledgments stored via upsert.
- Analytics: Completion rate (lesson_progress) + quiz performance (average score). RLS enforces role-based visibility.
- Realtime: Lessons and progress channels wired for auto-refresh.

## Troubleshooting
- Ensure Supabase env vars are correctly set in `.env`. Client will log a clear error if missing.
- Confirm storage bucket `lesson-files` exists and policies permit authenticated uploads and signed URL creation.
- Verify RLS policies match UI assumptions (see assets/supabase.md).

## Learn More
Standard CRA documentation applies.

