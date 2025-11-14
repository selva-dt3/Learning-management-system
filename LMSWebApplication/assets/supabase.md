# Supabase Integration Notes

- Auth: Uses `@supabase/supabase-js` v2 client configured via:
  - REACT_APP_SUPABASE_URL
  - REACT_APP_SUPABASE_ANON_KEY
- Email redirect: Uses REACT_APP_SITE_URL (default window.location.origin) for `emailRedirectTo` on sign up.

## Expected Tables (minimal)
- profiles: { id serial, user_id uuid (unique), role text, full_name text, department text, email text }
  - Policy: user can select their own row; Admin/HR may select broader as per compliance.
- lessons: { id uuid default gen_random_uuid(), title text, description text, status text, storage_path text, updated_at timestamp }
  - Policies: Admin can CRUD; others select published or assigned.
- onboarding_status: { user_id uuid pk, nda_signed bool, coc_signed bool, acknowledged_at timestamp }
  - Policies: owner can upsert/select; HR/Admin can select/report.
- lesson_progress: { user_id uuid, lesson_id uuid, completed bool, completed_at timestamp, primary key (user_id, lesson_id) }
  - Policy: owner upsert/select own; HR/Admin select for analytics.

## Storage
- Bucket: lesson-files (public or with signed URL access).
- UI uses `bucket/path.ext` for storage_path and requests a signed URL for view.

## Real-time
- Realtime enabled on tables: lessons, lesson_progress for channels.

Update policies in Supabase accordingly to match RLS-aware UI patterns.
