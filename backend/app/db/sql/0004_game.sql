-- Columns and seed support for M4-M9 (twin, game, leagues, quests, pots).
alter table lesson_progress
  add column started_at timestamptz not null default now(),
  add column combo int not null default 0,
  add column max_combo int not null default 0,
  add column combo_bonus int not null default 0,
  add column xp_earned int not null default 0,
  add column wrong int not null default 0,
  add column perfect boolean not null default false;
alter table answer_attempts
  add column lesson_id uuid references lessons(id) on delete set null,
  add column xp int not null default 0,
  add column suspicious boolean not null default false,
  add column chosen jsonb;
alter table student_stats
  add column today_xp int not null default 0,
  add column today_date date,
  add column play_seconds_today int not null default 0,
  add column last_activity_at timestamptz,
  add column league_tier text not null default 'bronze'
    check (league_tier in ('bronze','silver','gold','ruby','diamond')),
  add column best_combo int not null default 0,
  add column lessons_completed int not null default 0,
  add column perfect_lessons int not null default 0,
  add column quests_completed int not null default 0,
  add column pots_opened int not null default 0;
alter table quests add column event text not null default 'answer';
alter table pot_opens alter column opened_at drop default;
create index on answer_attempts (learner_id, question_id, created_at);
create index on gems_ledger (learner_id);
