# Aaroh Web

Browser version of Aaroh: a bilingual (Hindi/Kannada + English) learning game for Classes 6-10 science, with phone-call lessons.

- `apps/web` Next.js app (P2)
- `backend/` FastAPI backend (P1)
- `docs/` plans, progress, decisions

Local: `docker compose up --build` (Postgres + pgvector, API container).
Backend tests: `docker compose run --rm api pytest`.
