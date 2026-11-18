-- Translations of course, chapter and lesson titles (saved in one language) into en/hi/kn.
create table if not exists text_translations (
  source text primary key,
  en text not null,
  hi text not null,
  kn text not null,
  created_at timestamptz not null default now()
);
alter table text_translations enable row level security;   -- no policies: backend only
