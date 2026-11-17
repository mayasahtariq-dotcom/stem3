# Decisions
- M2: schema and RLS written as SQL files run by Alembic (not SQLAlchemy models); models are added per feature from M4. RLS tests run on the Supabase project in a rolled-back transaction.
