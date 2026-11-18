-- Each student's private link for a parent: anyone with the token sees that child's dashboard (read-only).
create table if not exists parent_share_links (
  learner_id uuid primary key references learners(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);
alter table parent_share_links enable row level security;   -- no policies: backend only
