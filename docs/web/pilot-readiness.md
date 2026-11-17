# Mooshala Web: pilot readiness checklist

**Status: NOT pilot ready.** It works as a demo on the fake backend. The items below must be done first.

## Works now (fake backend, tested)
- [x] Student: 3D farm, lessons with four question types, hearts/XP/streak, word book, doubt chat, shop, quests, village fair, badges, Golu Pot, mascot growth.
- [x] Teacher: overview, students, courses, upload notes, review and publish lessons, call mode for students without the app.
- [x] Parent: link by code, consent, weekly summary.
- [x] Hindi and Kannada everywhere, with English under each line. Every hi/kn string is listed for review.
- [x] Offline answers sync once (no duplicate rewards). Desktop and phone layouts.
- [x] Automated checks: TypeScript, ESLint, Vitest (unit, integration and axe on every story in hi and kn), Playwright journeys on desktop and phone with axe.

## Blocking a pilot
- [ ] **Real backend:** the game, call-mode and class-key endpoints, plus `Idempotency-Key` support (`docs/web/backend-handoff.md`). These are built by the backend developer.
- [ ] **Keys for real mode:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE_URL` (optional: `NEXT_PUBLIC_SENTRY_DSN`).
- [ ] **Translations:** a native reviewer checks every hi/kn draft in `docs/translations-to-review.md`.
- [ ] **PWA install** and app-shell offline cache (a reload while offline doesn't work yet).
- [ ] **Notifications** and preferences (needs Web Push on the backend and a VAPID key).
- [ ] **3D performance** measured on a low-end Android phone. The target is 30 fps; it hasn't been measured on a real device.
- [ ] **Manual accessibility pass** with a screen reader (TalkBack and NVDA). Automated axe checks pass, but that isn't a full audit.
- [ ] **Hosting:** the app is not deployed. It runs only on localhost.
