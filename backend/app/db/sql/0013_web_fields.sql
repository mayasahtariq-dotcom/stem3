-- Fields the web app shows: a class's subject and grade, and when an upload was started.
alter table classrooms add column subject text not null default 'BI' check (subject in ('BI','CH','PH')),
                       add column grade int not null default 7;
alter table uploads add column started_at timestamptz, add column classroom_id uuid references classrooms(id) on delete set null;
-- uploads made before the web app were started when they were created
update uploads set started_at = created_at where started_at is null;
