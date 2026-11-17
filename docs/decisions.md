# Decisions
- M2: schema and RLS written as SQL files run by Alembic (not SQLAlchemy models); models are added per feature from M4. RLS tests run on the Supabase project in a rolled-back transaction.
- M3: backend issues its own HS256 tokens signed with SUPABASE_JWT_SECRET (sub = users.id). Direct Supabase-client RLS access only works if that secret matches the project's JWT signing key; revisit at deploy. Real SMS provider deferred to Phase 6 (fake SMS used).
