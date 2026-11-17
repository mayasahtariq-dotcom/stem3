-- now() is frozen inside a transaction; answers must be timed with the real clock so they always
-- count after the lesson's start time.
alter table answer_attempts alter column created_at set default clock_timestamp();
