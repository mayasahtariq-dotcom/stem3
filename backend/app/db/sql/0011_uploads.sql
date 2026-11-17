-- Upload pipeline status (P3): photos/PDFs -> OCR -> outline -> first lesson.
alter table uploads
  add column status text not null default 'processing'
    check (status in ('processing','ocr','outline','done','failed')),
  add column error text,
  add column course_id uuid references courses(id) on delete set null,
  add column language text not null default 'hi',
  add column class_level int,
  add column elapsed_ms int,
  add column finished_at timestamptz;
alter table upload_pages
  add column mime text,
  add column confidence real;
