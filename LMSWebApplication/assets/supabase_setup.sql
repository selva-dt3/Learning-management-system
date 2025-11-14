-- Extracted runnable SQL from kavia-docs/supabase-lms-setup.md
-- Sections are ordered 0 through 12. This script is idempotent by design:
-- - Tables/Enums with IF NOT EXISTS
-- - Policies on public schema are dropped before create
-- - Storage.objects policies use DO $$ with pg_policies lookup to avoid duplicates
-- - Views use CREATE OR REPLACE

-- 0) Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 1) Domain types and enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('Admin','HR','Employee');
  end if;
  if not exists (select 1 from pg_type where typname = 'lesson_status') then
    create type public.lesson_status as enum ('draft', 'published');
  end if;
  if not exists (select 1 from pg_type where typname = 'question_type') then
    create type public.question_type as enum ('MCQ','TRUE_FALSE');
  end if;
  if not exists (select 1 from pg_type where typname = 'submission_status') then
    create type public.submission_status as enum ('submitted','reopened','invalidated');
  end if;
  if not exists (select 1 from pg_type where typname = 'assignee_type_enum') then
    create type public.assignee_type_enum as enum ('user','group','lesson');
  end if;
  if not exists (select 1 from pg_type where typname = 'invite_status') then
    create type public.invite_status as enum ('pending','accepted','revoked','failed');
  end if;
end$$;

-- 2) Core tables (create profiles first so functions/policies can reference it)
create table if not exists public.profiles (
  id bigserial primary key,
  user_id uuid unique not null references auth.users(id) on delete cascade,
  email text,
  role public.user_role not null default 'Employee',
  full_name text,
  department text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_profiles_user_id on public.profiles(user_id);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_department on public.profiles(department);

-- Helper function placed AFTER profiles creation; add safety if profiles missing
create or replace function public.current_app_role()
returns text
language sql
stable
security invoker
as $$
  select coalesce(
    (select p.role
     from pg_catalog.pg_tables t
     join public.profiles p on true
     where t.schemaname = 'public' and t.tablename = 'profiles'
       and p.user_id = auth.uid()
     limit 1),
    'Employee'
  );
$$;

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status public.lesson_status not null default 'draft',
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_lessons_status on public.lessons(status);
create index if not exists idx_lessons_updated_at on public.lessons(updated_at);

create table if not exists public.lesson_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists idx_lassign_user on public.lesson_assignments(user_id);
create index if not exists idx_lassign_lesson on public.lesson_assignments(lesson_id);

create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  primary key (user_id, lesson_id)
);
create index if not exists idx_lprogress_completed on public.lesson_progress(completed);

create table if not exists public.onboarding_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nda_signed boolean not null default false,
  coc_signed boolean not null default false,
  acknowledged_at timestamptz
);

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  shuffle boolean not null default false,
  time_limit_sec integer
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  text text not null,
  type public.question_type not null,
  points integer not null default 1,
  explanation text
);
create index if not exists idx_qq_quiz on public.quiz_questions(quiz_id);

create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  text text not null,
  is_correct boolean not null default false
);
create index if not exists idx_qans_q on public.quiz_answers(question_id);

create table if not exists public.quiz_submissions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  score integer,
  submitted_at timestamptz not null default now(),
  details jsonb,
  status public.submission_status not null default 'submitted'
);
create index if not exists idx_qsub_quiz on public.quiz_submissions(quiz_id);
create index if not exists idx_qsub_user on public.quiz_submissions(user_id);
create index if not exists idx_qsub_status on public.quiz_submissions(status);

create table if not exists public.quiz_submission_items (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.quiz_submissions(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  is_correct boolean not null,
  points integer not null default 1,
  earned integer not null default 0,
  selected text,
  correct text
);
create index if not exists idx_qsi_sub on public.quiz_submission_items(submission_id);
create index if not exists idx_qsi_q on public.quiz_submission_items(question_id);

create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  type public.question_type not null,
  points integer not null default 1,
  explanation text,
  created_at timestamptz not null default now()
);

create table if not exists public.question_bank_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question_bank(id) on delete cascade,
  text text not null,
  is_correct boolean not null default false
);
create index if not exists idx_qbans_q on public.question_bank_answers(question_id);

create table if not exists public.quiz_assignments (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  assignee_type public.assignee_type_enum not null,
  assignee_id text not null,
  due_at timestamptz,
  opens_at timestamptz,
  closes_at timestamptz,
  attempts_allowed integer not null default 1,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_qassign_quiz on public.quiz_assignments(quiz_id);
create index if not exists idx_qassign_type on public.quiz_assignments(assignee_type);
create index if not exists idx_qassign_assignee on public.quiz_assignments(assignee_id);

create table if not exists public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.user_role not null,
  department text,
  invited_by uuid,
  status public.invite_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists idx_invites_email on public.user_invitations(email);
create index if not exists idx_invites_status on public.user_invitations(status);

-- 3) Updated-at triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lessons_updated on public.lessons;
create trigger trg_lessons_updated before update on public.lessons
for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
for each row execute function public.set_updated_at();

-- 4) Auth sync
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(user_id, email, role, full_name, department)
  values (new.id, new.email, coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'Employee'), new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'department')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 5) Enable RLS
alter table public.profiles enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_assignments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.onboarding_status enable row level security;

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.quiz_submissions enable row level security;
alter table public.quiz_submission_items enable row level security;

alter table public.question_bank enable row level security;
alter table public.question_bank_answers enable row level security;

alter table public.quiz_assignments enable row level security;
alter table public.user_invitations enable row level security;

-- 6) RLS Policies (drop then create) with table existence guard for safety
do $$
begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='profiles') then
    drop policy if exists "profiles_self_select" on public.profiles;
    create policy "profiles_self_select" on public.profiles
    for select using (user_id = auth.uid() or public.current_app_role() in ('Admin','HR'));

    drop policy if exists "profiles_self_upsert" on public.profiles;
    create policy "profiles_self_upsert" on public.profiles
    for insert with check (user_id = auth.uid());

    drop policy if exists "profiles_self_update" on public.profiles;
    create policy "profiles_self_update" on public.profiles
    for update using (user_id = auth.uid() or public.current_app_role() in ('Admin','HR'))
    with check (
      case
        when public.current_app_role() in ('Admin','HR') then true
        else user_id = auth.uid() and (role is null or role = (select role from public.profiles where user_id = auth.uid()))
      end
    );
  end if;
end$$;

-- Continue with other policies (tables already created earlier)

drop policy if exists "lessons_admin_hr_crud" on public.lessons;
create policy "lessons_admin_hr_crud" on public.lessons
for all using (public.current_app_role() in ('Admin','HR'))
with check (public.current_app_role() in ('Admin','HR'));

drop policy if exists "lessons_employee_select" on public.lessons;
create policy "lessons_employee_select" on public.lessons
for select using (
  status = 'published'
  or exists (
    select 1 from public.lesson_assignments la
    where la.lesson_id = lessons.id and la.user_id = auth.uid()
  )
);

drop policy if exists "lassign_admin_hr_manage" on public.lesson_assignments;
create policy "lassign_admin_hr_manage" on public.lesson_assignments
for all using (public.current_app_role() in ('Admin','HR'))
with check (public.current_app_role() in ('Admin','HR'));

drop policy if exists "lassign_owner_select" on public.lesson_assignments;
create policy "lassign_owner_select" on public.lesson_assignments
for select using (user_id = auth.uid());

drop policy if exists "lprogress_owner_upsert" on public.lesson_progress;
create policy "lprogress_owner_upsert" on public.lesson_progress
for insert with check (user_id = auth.uid());

drop policy if exists "lprogress_owner_update" on public.lesson_progress;
create policy "lprogress_owner_update" on public.lesson_progress
for update using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "lprogress_owner_select" on public.lesson_progress;
create policy "lprogress_owner_select" on public.lesson_progress
for select using (user_id = auth.uid() or public.current_app_role() in ('Admin','HR'));

drop policy if exists "onboarding_owner_upsert" on public.onboarding_status;
create policy "onboarding_owner_upsert" on public.onboarding_status
for insert with check (user_id = auth.uid());

drop policy if exists "onboarding_owner_update" on public.onboarding_status;
create policy "onboarding_owner_update" on public.onboarding_status
for update using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "onboarding_select" on public.onboarding_status;
create policy "onboarding_select" on public.onboarding_status
for select using (user_id = auth.uid() or public.current_app_role() in ('Admin','HR'));

drop policy if exists "quizzes_admin_hr_crud" on public.quizzes;
create policy "quizzes_admin_hr_crud" on public.quizzes
for all using (public.current_app_role() in ('Admin','HR'))
with check (public.current_app_role() in ('Admin','HR'));

drop policy if exists "quizzes_employee_select" on public.quizzes;
create policy "quizzes_employee_select" on public.quizzes
for select using (
  exists (
    select 1 from public.quiz_assignments qa
    where qa.quiz_id = quizzes.id
  )
  or public.current_app_role() in ('Admin','HR')
);

drop policy if exists "quiz_questions_admin_hr_crud" on public.quiz_questions;
create policy "quiz_questions_admin_hr_crud" on public.quiz_questions
for all using (public.current_app_role() in ('Admin','HR'))
with check (public.current_app_role() in ('Admin','HR'));

drop policy if exists "quiz_questions_employee_select" on public.quiz_questions;
create policy "quiz_questions_employee_select" on public.quiz_questions
for select using (
  public.current_app_role() in ('Admin','HR')
  or exists (select 1 from public.quizzes q where q.id = quiz_questions.quiz_id)
);

drop policy if exists "quiz_answers_admin_hr_crud" on public.quiz_answers;
create policy "quiz_answers_admin_hr_crud" on public.quiz_answers
for all using (public.current_app_role() in ('Admin','HR'))
with check (public.current_app_role() in ('Admin','HR'));

drop policy if exists "quiz_answers_employee_select" on public.quiz_answers;
create policy "quiz_answers_employee_select" on public.quiz_answers
for select using (
  public.current_app_role() in ('Admin','HR')
  or exists (select 1 from public.quiz_questions qq where qq.id = quiz_answers.question_id)
);

drop policy if exists "qsub_owner_insert" on public.quiz_submissions;
create policy "qsub_owner_insert" on public.quiz_submissions
for insert with check (user_id = auth.uid());

drop policy if exists "qsub_owner_select" on public.quiz_submissions;
create policy "qsub_owner_select" on public.quiz_submissions
for select using (user_id = auth.uid() or public.current_app_role() in ('Admin','HR'));

drop policy if exists "qsub_admin_hr_update" on public.quiz_submissions;
create policy "qsub_admin_hr_update" on public.quiz_submissions
for update using (public.current_app_role() in ('Admin','HR'))
with check (public.current_app_role() in ('Admin','HR'));

drop policy if exists "qsi_owner_select" on public.quiz_submission_items;
create policy "qsi_owner_select" on public.quiz_submission_items
for select using (
  exists (
    select 1 from public.quiz_submissions s
    where s.id = quiz_submission_items.submission_id
      and (s.user_id = auth.uid() or public.current_app_role() in ('Admin','HR'))
  )
);

drop policy if exists "qbank_admin_hr_crud" on public.question_bank;
create policy "qbank_admin_hr_crud" on public.question_bank
for all using (public.current_app_role() in ('Admin','HR'))
with check (public.current_app_role() in ('Admin','HR'));

drop policy if exists "qbank_employee_select" on public.question_bank;
create policy "qbank_employee_select" on public.question_bank
for select using (true);

drop policy if exists "qbank_answers_admin_hr_crud" on public.question_bank_answers;
create policy "qbank_answers_admin_hr_crud" on public.question_bank_answers
for all using (public.current_app_role() in ('Admin','HR'))
with check (public.current_app_role() in ('Admin','HR'));

drop policy if exists "qbank_answers_employee_select" on public.question_bank_answers;
create policy "qbank_answers_employee_select" on public.question_bank_answers
for select using (true);

drop policy if exists "qassign_admin_hr_crud" on public.quiz_assignments;
create policy "qassign_admin_hr_crud" on public.quiz_assignments
for all using (public.current_app_role() in ('Admin','HR'))
with check (public.current_app_role() in ('Admin','HR'));

drop policy if exists "invites_admin_select_insert_update" on public.user_invitations;
create policy "invites_admin_select_insert_update" on public.user_invitations
for all using (public.current_app_role() = 'Admin')
with check (public.current_app_role() = 'Admin');

-- 7) Views and RPC helpers
create or replace view public.quiz_submission_items_with_question as
select
  i.submission_id,
  i.question_id,
  q.text as question_text,
  i.is_correct
from public.quiz_submission_items i
join public.quiz_questions q on q.id = i.question_id;

create or replace view public.quiz_assignments_view as
with lesson_map as (
  select la.user_id, qa.quiz_id, la.lesson_id, qa.due_at::date as due_date
  from public.quiz_assignments qa
  join public.lesson_assignments la
    on qa.assignee_type = 'lesson'
   and qa.assignee_id::uuid = la.lesson_id
),
user_map as (
  select u.id as user_id, qa.quiz_id, null::uuid as lesson_id, qa.due_at::date as due_date
  from public.quiz_assignments qa
  join auth.users u on qa.assignee_type = 'user' and qa.assignee_id = u.id::text
)
select * from lesson_map
union all
select * from user_map;

create or replace view public.user_quiz_assignments_resolved as
with base as (
  select
    u.id as user_id,
    qa.quiz_id,
    qa.id as assignment_id,
    qa.due_at,
    qa.opens_at,
    qa.closes_at,
    qa.attempts_allowed
  from public.quiz_assignments qa
  join auth.users u
    on qa.assignee_type = 'user'
   and qa.assignee_id = u.id::text

  union all

  select
    p.user_id,
    qa.quiz_id,
    qa.id as assignment_id,
    qa.due_at,
    qa.opens_at,
    qa.closes_at,
    qa.attempts_allowed
  from public.quiz_assignments qa
  join public.profiles p
    on qa.assignee_type = 'group'
   and qa.assignee_id = coalesce(p.department, '')

  union all

  select
    la.user_id,
    qa.quiz_id,
    qa.id as assignment_id,
    qa.due_at,
    qa.opens_at,
    qa.closes_at,
    qa.attempts_allowed
  from public.quiz_assignments qa
  join public.lesson_assignments la
    on qa.assignee_type = 'lesson'
   and qa.assignee_id::uuid = la.lesson_id
)
select * from base;

create or replace function public.get_user_quiz_assignments_resolved(p_user_id uuid)
returns table(
  user_id uuid,
  quiz_id uuid,
  assignment_id uuid,
  due_at timestamptz,
  opens_at timestamptz,
  closes_at timestamptz,
  attempts_allowed int
)
language sql
stable
security definer
set search_path = public
as $$
  select v.user_id, v.quiz_id, v.assignment_id, v.due_at, v.opens_at, v.closes_at, v.attempts_allowed
  from public.user_quiz_assignments_resolved v
  where v.user_id = p_user_id;
$$;
revoke all on function public.get_user_quiz_assignments_resolved(uuid) from public;
grant execute on function public.get_user_quiz_assignments_resolved(uuid) to anon, authenticated;

-- 8) Storage: bucket and idempotent policies
insert into storage.buckets (id, name, public)
values ('lesson-files', 'lesson-files', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_policies pol
    where pol.policyname = 'lesson-files-insert'
      and pol.schemaname = 'storage'
      and pol.tablename = 'objects'
  ) then
    create policy "lesson-files-insert"
    on storage.objects
    for insert
    to authenticated
    with check (bucket_id = 'lesson-files');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_policies pol
    where pol.policyname = 'lesson-files-update-own'
      and pol.schemaname = 'storage'
      and pol.tablename = 'objects'
  ) then
    create policy "lesson-files-update-own"
    on storage.objects
    for update
    to authenticated
    using (bucket_id = 'lesson-files' and owner = auth.uid())
    with check (bucket_id = 'lesson-files' and owner = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_policies pol
    where pol.policyname = 'lesson-files-delete-own'
      and pol.schemaname = 'storage'
      and pol.tablename = 'objects'
  ) then
    create policy "lesson-files-delete-own"
    on storage.objects
    for delete
    to authenticated
    using (bucket_id = 'lesson-files' and owner = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_policies pol
    where pol.policyname = 'lesson-files-read-auth'
      and pol.schemaname = 'storage'
      and pol.tablename = 'objects'
  ) then
    create policy "lesson-files-read-auth"
    on storage.objects
    for select
    to authenticated
    using (bucket_id = 'lesson-files');
  end if;
end $$;

-- 9) Useful indexes
create index if not exists idx_qsub_quiz_status on public.quiz_submissions(quiz_id, status);
create index if not exists idx_qassign_opens_closes on public.quiz_assignments(opens_at, closes_at);

-- 10) Optional RPC for active assignment
create or replace function public.has_active_assignment(p_user_id uuid, p_quiz_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.user_quiz_assignments_resolved v
    where v.user_id = p_user_id
      and v.quiz_id = p_quiz_id
      and (v.opens_at is null or v.opens_at <= now())
      and (v.closes_at is null or v.closes_at >= now())
  );
$$;
revoke all on function public.has_active_assignment(uuid, uuid) from public;
grant execute on function public.has_active_assignment(uuid, uuid) to authenticated, anon;

-- 11) No-op here; environment & realtime configured via UI

-- 12) End of script
-- Re-run this script safely to verify idempotency; storage policies are guarded by DO $$ blocks, public policies are re-created after drop.
