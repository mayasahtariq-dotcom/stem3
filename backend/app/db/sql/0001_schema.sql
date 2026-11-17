-- Aaroh schema (PRD section 8). Server owns all game numbers; clients only read via RLS.
create extension if not exists vector;
create extension if not exists pgcrypto;

-- ===== People =====
create table users (
  id uuid primary key default gen_random_uuid(),   -- equals auth.uid() for logged-in users
  role text not null check (role in ('student','teacher','parent','admin')),
  language text not null default 'hi' check (language in ('hi','kn','en')),
  name text not null,
  nickname text,
  phone_e164 text unique,
  league_opt_out boolean not null default false,
  created_at timestamptz not null default now()
);
create table classrooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references users(id) on delete cascade,
  name text not null,
  class_key text not null unique,
  league_enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create table memberships (
  classroom_id uuid not null references classrooms(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  primary key (classroom_id, user_id)
);
create table call_students (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references classrooms(id) on delete cascade,
  name text not null,
  phone_e164 text not null,
  language text not null check (language in ('hi','kn')),
  call_days int[] not null default '{1,2,3,4,5,6}',
  window_start time not null default '17:00',
  window_end time not null default '19:00',
  parent_phone_e164 text,
  status text not null default 'waiting_consent'
    check (status in ('waiting_consent','active','paused','not_reachable','declined')),
  created_at timestamptz not null default now(),
  check (window_start >= '09:00' and window_end <= '21:00' and window_start < window_end)
);
-- One learner id for both app students and call-only students.
create table learners (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('app','call')),
  user_id uuid unique references users(id) on delete cascade,
  call_student_id uuid unique references call_students(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((kind='app' and user_id is not null and call_student_id is null)
      or (kind='call' and call_student_id is not null and user_id is null))
);
create table parent_links (
  parent_id uuid not null references users(id) on delete cascade,
  learner_id uuid not null references learners(id) on delete cascade,
  primary key (parent_id, learner_id)
);
create table link_codes (
  code text primary key,
  learner_id uuid not null references learners(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);
create table consent_records (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  given_by text not null check (given_by in ('parent_app','parent_keypress','school')),
  granted boolean not null,
  created_at timestamptz not null default now()
);
create table deletion_requests (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null,   -- no FK: must outlive the learner row
  requested_by uuid,
  status text not null default 'pending' check (status in ('pending','done')),
  created_at timestamptz not null default now()
);

-- ===== Content =====
create table uploads (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table upload_pages (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references uploads(id) on delete cascade,
  page_no int not null,
  storage_path text not null,
  ocr_text text
);
create table courses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references users(id) on delete cascade,
  title text not null,
  subject text not null check (subject in ('biology','chemistry','physics')),
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now()
);
create table units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  position int not null,
  title text not null
);
create table lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units(id) on delete cascade,
  position int not null,
  title text not null
);
create table questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  kind text not null check (kind in ('mcq','true_false','match','fill_in')),
  prompt jsonb not null,          -- {regional, english}
  options jsonb,
  answer jsonb not null,          -- never sent to clients before answering
  concept text,
  call_safe boolean not null default false,
  flagged boolean not null default false,
  source_page_id uuid references upload_pages(id) on delete set null
);
create table terms (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  regional text not null,
  english text not null,
  definition jsonb
);
create table course_assignments (
  course_id uuid not null references courses(id) on delete cascade,
  classroom_id uuid not null references classrooms(id) on delete cascade,
  primary key (course_id, classroom_id)
);

-- ===== Learning =====
create table answer_attempts (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  correct boolean not null,
  first_try boolean not null,
  channel text not null check (channel in ('web','call')),
  created_at timestamptz not null default now()
);
create table lesson_progress (
  learner_id uuid not null references learners(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  status text not null default 'started' check (status in ('started','completed')),
  accuracy numeric,
  completed_at timestamptz,
  primary key (learner_id, lesson_id)
);
create table doubts (            -- doubt text is private to the learner
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);
create table saved_terms (
  learner_id uuid not null references learners(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  primary key (learner_id, term_id)
);
create table audio_cache (
  id uuid primary key default gen_random_uuid(),
  text_hash text not null,
  language text not null,
  storage_path text not null,
  unique (text_hash, language)
);

-- ===== Student Twin =====
create table twin_concepts (
  learner_id uuid not null references learners(id) on delete cascade,
  concept text not null,
  mastery real not null default 0 check (mastery between 0 and 1),
  half_life_days real not null default 1,
  last_seen timestamptz,
  next_review timestamptz,
  primary key (learner_id, concept)
);
create table twin_confusions (
  learner_id uuid not null references learners(id) on delete cascade,
  concept text not null,
  confused_with text not null,
  count int not null default 1,
  primary key (learner_id, concept, confused_with)
);

-- ===== Game =====
create table student_stats (
  learner_id uuid primary key references learners(id) on delete cascade,
  xp int not null default 0,
  streak int not null default 0,
  last_goal_date date,
  daily_goal int not null default 20 check (daily_goal in (20,50,100)),
  hearts int not null default 5 check (hearts between 0 and 5),
  hearts_updated_at timestamptz not null default now(),
  freezes int not null default 0 check (freezes between 0 and 2)
);
create table gems_ledger (       -- append-only
  id bigint generated always as identity primary key,
  learner_id uuid not null references learners(id) on delete cascade,
  delta int not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create table quests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('daily','weekly','revision')),
  code text not null unique,
  target int not null,
  gems int not null default 20
);
create table quest_progress (
  learner_id uuid not null references learners(id) on delete cascade,
  quest_id uuid not null references quests(id) on delete cascade,
  period_start date not null,
  progress int not null default 0,
  completed boolean not null default false,
  primary key (learner_id, quest_id, period_start)
);
create table badges (
  code text primary key,
  title jsonb not null
);
create table badge_awards (
  learner_id uuid not null references learners(id) on delete cascade,
  badge_code text not null references badges(code),
  awarded_at timestamptz not null default now(),
  primary key (learner_id, badge_code)
);
create table leagues (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references classrooms(id) on delete cascade,
  tier text not null check (tier in ('bronze','silver','gold','ruby','diamond')),
  week_start date not null
);
create table league_pods (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade
);
create table league_scores (
  pod_id uuid not null references league_pods(id) on delete cascade,
  learner_id uuid not null references learners(id) on delete cascade,
  xp int not null default 0,
  primary key (pod_id, learner_id)
);
create table pot_opens (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete set null,
  reward jsonb,
  opened_at timestamptz
);
create table mascot_state (
  learner_id uuid primary key references learners(id) on delete cascade,
  stage text not null default 'calf' check (stage in ('calf','cow','champion')),
  outfit jsonb not null default '{}'
);

-- ===== Calls =====
create table call_sessions (
  id uuid primary key default gen_random_uuid(),
  call_student_id uuid not null references call_students(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','ringing','answered','missed','failed','completed')),
  attempt int not null default 1,
  seconds_used int not null default 0,
  provider_call_id text,
  created_at timestamptz not null default now()
);
create table call_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references call_sessions(id) on delete cascade,
  kind text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);
create table call_audio (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references lessons(id) on delete cascade,
  language text not null,
  key text not null,
  storage_path text not null
);

-- ===== Audit log (consent, deletion, call events; kept 1 year) =====
create table audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- Gems ledger is append-only
create function gems_ledger_immutable() returns trigger language plpgsql as $$
begin raise exception 'gems_ledger is append-only'; end $$;
create trigger gems_ledger_no_update before update or delete on gems_ledger
  for each row execute function gems_ledger_immutable();

create index on answer_attempts (learner_id, created_at);
create index on twin_concepts (learner_id, next_review);
create index on call_sessions (call_student_id, scheduled_for);
