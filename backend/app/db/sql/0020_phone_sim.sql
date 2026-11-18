-- Browser phone simulator: answers carry the channel, and each simulated call is logged as a session.
alter table answer_attempts drop constraint if exists answer_attempts_channel_check;
alter table answer_attempts add constraint answer_attempts_channel_check
  check (channel in ('web','call','phone_simulator'));
create table if not exists sim_sessions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references learners(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete set null,
  status text not null default 'active' check (status in ('active','completed','ended')),
  answered int not null default 0,
  correct int not null default 0,
  incorrect int not null default 0,
  question_index int not null default 0,
  question_count int not null default 0,
  lessons_completed int not null default 0,
  seconds int not null default 0,
  started_at timestamptz not null default now(),
  last_at timestamptz not null default now()
);
create index if not exists sim_sessions_learner on sim_sessions (learner_id, started_at);
alter table sim_sessions enable row level security;   -- no policies: backend only
