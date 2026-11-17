-- One row per learner per finished course; also records whether the parent SMS went out.
create table course_completions (
  learner_id uuid not null references learners(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  completed_at timestamptz not null default now(),
  sms_status text not null default 'none'
    check (sms_status in ('none','sent','failed','queued_quiet','no_parent','no_consent')),
  primary key (learner_id, course_id)
);
alter table course_completions enable row level security;
grant select on course_completions to authenticated;
create policy completions_read on course_completions for select to authenticated
  using (private.can_read_learner(learner_id));
