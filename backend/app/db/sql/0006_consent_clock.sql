-- now() is frozen inside a transaction; use the real clock so "latest consent wins" is exact.
alter table consent_records alter column created_at set default clock_timestamp();
