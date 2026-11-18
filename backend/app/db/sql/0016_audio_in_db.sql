-- Generated speech lives in the row too: the host's disk is wiped on every deploy.
alter table audio_cache add column if not exists data bytea;
