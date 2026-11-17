-- Web app onboarding: an account exists after OTP, and is "registered" once name/role are set.
alter table users add column registered boolean not null default true;
