# Aaroh Web — P1 Milestones (M0–M12)

P1 = tech lead / core backend. Milestones run in order; a milestone is done only when its checks pass and CI is green. Tick items in `docs/progress.md`, log deviations in `docs/decisions.md`.

## Phase 1 — Foundation (weeks 1–3)

**M0 — Repo and tooling**
- Monorepo (pnpm + Turborepo): `apps/web`, `packages/`, `backend/`, `docs/`, `supabase/policies/`
- `.gitignore`, `.env.example` files (empty values), Docker Compose (Postgres 16 + pgvector)
- Python 3.12 venv, ruff + mypy strict, pytest set up
- Done when: `docker compose up` runs and `pytest` passes on a trivial test
- Non-code: request Exotel Voicebot activation

**M1 — Backend skeleton**
- FastAPI app, pydantic-settings, `/health`, structured JSON logs
- Fake providers behind interfaces: LLM, Speech, Telephony (flags `USE_FAKE_*`)
- Done when: API runs locally with no real keys

**M2 — Schema and security**
- SQLAlchemy models + Alembic first migration for all PRD §8 tables
- Row-level security policies (student own data, teacher own classes, parent linked children)
- Done when: RLS tests pass against a real Postgres

**M3 — Auth and CI**
- `/auth/otp`, `/auth/verify`, `/auth/class-key` (OTP rate limits)
- OpenAPI file published for P2/P3
- GitHub Actions: lint, type check, tests, build
- Done when: P2 can generate a typed client; CI is green

## Phase 2 — Student core (weeks 4–8)

**M4 — Attempts and Student Twin**
- `POST /attempts` with server-side answer validation
- Twin: mastery, forgetting (half-life, next review), confusions
- Done when: unit tests cover mastery updates and forgetting

**M5 — Game basics + student endpoints**
- XP, combo, daily goal, streak, hearts, gems ledger (append-only)
- `/home`, `/courses/{id}/path`, `/lessons/{id}/start`, `/lessons/{id}/complete`
- Done when: **Gate: playable demo** with P2's lesson player

## Phase 3 — Teacher and parent (weeks 9–13)

**M6 — Classes, publishing, dashboard**
- Classrooms, join by key/QR/link, course assignment and publish
- `/classrooms/{id}/dashboard` data (weak topics, idle students)

**M7 — Parent, consent, deletion**
- Parent link codes, weekly summary data, consent / revoke, deletion requests, audit log
- Call-student records (no calling yet)
- Done when: teacher → course → student → parent works end to end

## Phase 4 — Full game layer (weeks 14–17)

**M8 — Leagues, quests, badges**
- Pods of 10, five tiers, Monday 00:00 IST reset; 3 daily + 1 weekly quest; ~40 badges; revision quest from the Twin

**M9 — Pots, mascot, guardrails, realtime**
- Golu Pot, mascot growth, quiet hours, 45-minute soft limit, anti-cheat, `WSS /realtime`
- Done when: game loop complete and anti-cheat tests pass

## Phase 5 — Call mode (weeks 18–23)

**M10 — Call engine**
- Exotel client, call state machine, webhooks, consent call (press 1/2, 3-day retry), caller ID with sibling choice
- Scheduler (every 5 min, window, weekly cap, retries, "Not reachable")

**M11 — Call lessons and cost caps**
- DTMF lesson flow (`WSS /calls/stream`), in-call XP/league, missed-call callback in 60s, per-student and per-class cost caps
- Done when: **Gate: real call works in Hindi and Kannada**

## Phase 6 — Pilot (weeks 24–28)

**M12 — Hardening and release**
- Web push backend, weekly SMS + DLT templates, admin APIs, rate limits, CSP/HSTS, security review, DPDP/TRAI checks, load test, production deploy, Sentry + cost dashboards
- Done when: **Gate: pilot go / no-go**
