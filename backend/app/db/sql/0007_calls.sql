alter table call_sessions
  add column kind text not null default 'lesson' check (kind in ('consent','lesson')),
  add column learner_id uuid references learners(id) on delete cascade,
  add column state jsonb not null default '{}'::jsonb,
  add column ended_at timestamptz;
