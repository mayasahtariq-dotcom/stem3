-- Questions play in the order the teacher (or P3's pipeline) wrote them.
alter table questions add column position int not null default 0;
