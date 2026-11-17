create table otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);
create index on otp_codes (phone_e164, created_at desc);
alter table otp_codes enable row level security;   -- no policies: backend only
