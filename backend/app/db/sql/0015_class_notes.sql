-- Class notes: what a teacher shares with a class for students to read later.
-- Files live in the row (small, <= a few MB) because the host's disk is wiped on redeploy.
create table class_notes (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references classrooms(id) on delete cascade,
  teacher_id uuid not null references users(id) on delete cascade,
  title text not null,
  body text not null default '',
  file_name text,
  file_type text,
  file_data bytea,
  -- set when the note was shared automatically from course-generation notes
  upload_page_id uuid references upload_pages(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  unique (classroom_id, upload_page_id)
);
create index class_notes_classroom on class_notes(classroom_id, created_at desc);
alter table class_notes enable row level security;   -- no policies: backend only
