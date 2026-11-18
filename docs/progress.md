# Progress (P1)

- [x] M0 Repo and tooling (scaffold)
- [ ] M0 Exotel Voicebot activation requested
- [x] M1 Backend skeleton (tests, ruff, mypy pass on Python 3.14; re-check on 3.12 in Docker)
- [x] M2 Schema and security (SQL migrations via Alembic; 9 RLS tests pass on Supabase)
- [x] M3 Auth and CI (OTP + class-key login, OpenAPI file, GitHub Actions)
- [x] M4 Twin model, answer checking, POST /attempts (server-side validation)
- [x] M5 XP, combo, streak (+freezes), hearts, gems ledger, path/home/lesson endpoints
- [x] M6 Classes, join by key, courses (bulk content import), review/edit, publish, assign, dashboard
- [x] M7 Parent link codes, weekly summary, consent/revoke, deletion, call-student records
- [x] M8 Leagues (pods of 10, 5 tiers, weekly reset logic), quests (daily/weekly/revision), 43 badges
- [x] M9 Golu Pot, mascot growth, outfits/freeze/hearts spending, guardrails, WSS /realtime
- [x] M10/M11 scheduler: window calls, retries, consent tries, not reachable, held SMS, weekly SMS, Monday league reset

## Web: farm worlds (frontend-sandra)
- [x] Five explorable 3D fields that unlock by XP, with a Meadow Levels screen and unlock card
- [x] Farm Store (5 categories, 3D preview, gem prices, idempotent buy) and My items
- [x] Free placement per field: drag, rotate, confirm, cancel, move, put away, validated (water, paths, buildings, slope, bounds, overlap)
- [x] Layouts saved per field with version conflicts handled (fake backend)
- [ ] Real backend endpoints (see docs/web/backend-handoff.md)

## Web: browser phone call simulator + unified digital twin
- [x] Call simulator page (/phone): phone UI, shared simulated number, call status and timer, keypad, transcript, current question
- [x] Call flow: connecting, student ID + PIN against existing students, welcome, continue lesson or pick course and lesson
- [x] Keypad 1-5 choose, 6 repeat, 7 read choice, 8 clear, 9 confirm, 0 help; physical keyboard too
- [x] Real lesson questions, server grading, attempts saved as they happen, lesson completion and XP on the same student
- [x] Answers tagged PHONE_SIMULATOR (X-Channel), session log with interrupted calls, resume where the student stopped
- [x] Teacher and parent "Phone simulator activity" cards with App vs Phone simulator split
- [x] Voice in the student's language (server voice translates English lines first); parent link codes are 6 characters
