-- Lesson types for the web player: quiz, video, reading, interactive.
alter table lessons
  add column kind text not null default 'quiz' check (kind in ('quiz','video','reading','interactive')),
  add column content jsonb not null default '{}'::jsonb;
alter table doubts
  add column lesson_id uuid references lessons(id) on delete set null,
  add column answer text,
  add column citation jsonb;
