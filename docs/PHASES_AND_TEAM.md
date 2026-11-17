# Aaroh Web — Phases & 3-Person Allocation

Source: `Mooshala Web Product Requirements.docx` (17 Nov 2026). **The product name is Aaroh**; wherever the PRD says "Mooshala", read "Aaroh" (repo `aaroh-web`, UI copy, docs, domains).
Plan: 6 phases, ~28 weeks, 3 gates (PRD §11). Build phases strictly in order; no features from a later phase early.

## Team (3 people, P1 carries the heavy work)

| Person | Role | Owns | Share of work |
|---|---|---|---|
| **P1: Tech lead / Core backend** | Backend, infra, game and call engines | FastAPI, DB/Alembic/RLS, auth, jobs, CI/CD, hosting, security + DPDP, Student Twin, all game rules (XP, streak, hearts, gems, leagues, quests, badges, pots), realtime WebSockets, **all of call mode** (Exotel, scheduler, caller ID, DTMF, consent calls), cost caps, audit log | ~50% |
| **P2: Frontend / UX** | Full-stack frontend | `apps/web`: design system, student, teacher, parent screens, call console UI, bilingual text, animation + sound, a11y, PWA/offline, web push UI, Playwright/axe tests | ~30% |
| **P3: AI / Content / QA** | AI engineer + QA | LLMProvider, OCR, lesson/question generation, doubt chat with citations, Sarvam TTS + audio cache, call audio prep, push/SMS sending, admin console backend, translation review log, test plans and pilot QA | ~20% |

## Phases and who does what

### Phase 1 — Foundation (weeks 1–3)
Goal: skeleton deployed, login works, CI green.
- **P1:** monorepo (pnpm + Turborepo), Docker Compose, Postgres + pgvector, full schema + Alembic, row-level security, phone OTP + class-key login, OpenAPI contract, CI, fake providers pattern. **Request Exotel Voicebot activation in week 1.**
- **P2:** Next.js shell, design tokens, core components (ChunkyButton, AnswerOption, BilingualText, etc.), next-intl (en/hi/kn), auth screens, Storybook.
- **P3:** LLMProvider and SpeechProvider interfaces + fakes, spike on Surya OCR and Sarvam TTS, `translations-to-review.md` set up.

### Phase 2 — Student core (weeks 4–8) — Gate: playable demo
- **P1:** attempts endpoint with server-side validation, Student Twin (mastery, forgetting, confusions), XP, combo, daily goal, streak, hearts, gems ledger, `/home`, `/path`, lesson start/complete.
- **P2:** learning path, lesson player (MCQ, T/F, match, fill-in, wrong answers return), top stats bar, XP pops, keyboard play, term cards, glossary.
- **P3:** doubt chat with page citations, TTS "Listen" in Hindi and Kannada, seed course content for the demo.

### Phase 3 — Teacher and parent (weeks 9–13)
- **P1:** classrooms, join by key/QR/link, class dashboard data (weak topics, idle students), course assignment and publish, call-student records (no calling yet), parent links, weekly summary, consent / revoke / deletion flows, audit log.
- **P2:** teacher app (multi-file upload, review screen with flagged questions first, edit/regenerate/delete, publish, dashboard with charts), parent app (link, summary, consent, switch children).
- **P3:** upload → OCR → AI outline → first lesson in under 60 seconds, low-confidence flags, weekly summary text and its audio.

### Phase 4 — Full game layer (weeks 14–17)
- **P1:** leagues (pods of 10, five tiers, Monday 00:00 IST reset), quests, ~40 badges, Golu Pot, mascot growth, revision quest from the Twin, anti-cheat, quiet hours and the 45-minute soft limit, realtime events.
- **P2:** league, quests, badges, profile and trophy shelf, Golu Pot opening, mascot scenes, confetti, motion and sound, reduced-motion mode.
- **P3:** badge and quest copy in en/hi/kn, translation review pass, gamification test scenarios (cheating, edge cases).

### Phase 5 — Call mode (weeks 18–23) — Gate: real call works in Hindi and Kannada
- **P1:** Exotel client, call state machine, 5-minute scheduler (window, weekly cap, retries, "Not reachable"), consent call (press 1/2, 3-day retry), caller ID with sibling disambiguation, DTMF lesson flow, missed-call callback in 60s, webhooks, `/calls/stream`, call XP/league, per-student and per-class cost caps.
- **P2:** "Add student without phone app" form, teacher call console (status, Pause, Call now, window edit, cost report, twin card), phone icon in lists and leagues.
- **P3:** pre-recorded 8 kHz call audio generated on publish, stitched clips (name, streak, score), Hindi and Kannada prompt review, real-call test script, weekly SMS content.

### Phase 6 — Pilot (weeks 24–28) — Gate: pilot go / no-go
- **P1:** web push backend, weekly SMS + DLT templates, admin console APIs, rate limits, CSP/HSTS, security review, DPDP/TRAI checks with counsel, load and performance work, production deploy, observability (Sentry, call cost dashboards).
- **P2:** PWA and offline lesson cache with sync, push opt-in UI, admin console UI, WCAG 2.2 AA audit fixes, <3s first load on slow 4G.
- **P3:** pilot QA and bug triage, analytics and healthy-play dashboards, final translation sign-off, teacher/parent onboarding material.

## Timeline at a glance

| Weeks | P1 | P2 | P3 |
|---|---|---|---|
| 1–3 | Platform, schema, auth | Design system, shell | Provider fakes, spikes |
| 4–8 | Twin, XP, streak, hearts | Path, lesson player | Doubts, TTS, seed content |
| 9–13 | Classes, consent, parent data | Teacher + parent UIs | OCR to lesson pipeline |
| 14–17 | Leagues, quests, badges | Game UI, motion | Copy, QA of game rules |
| 18–23 | **Call mode (heavy)** | Call console | Call audio, real-call tests |
| 24–28 | Hardening, compliance, deploy | PWA, a11y | Pilot QA, analytics |

## Because P1 is heavy
- P1 should publish the OpenAPI contract early in Phase 1 so P2 and P3 can build against fakes without waiting.
- P3 takes the lighter backend pieces (AI, audio, push/SMS sending, admin) to offload P1; P2 reviews P1's PRs touching the game UI contract.
- Biggest schedule risk is P1 in Phase 5 (all call mode). If it slips, move consent-call and cost-report work to P3.

## Risks to watch (from PRD §11)
- Exotel Voicebot not enabled in time → request in week 1, build on the fake telephony provider.
- TRAI / DLT rules → register SMS templates early; verify before pilot.
- Hindi/Kannada quality → log every string; native-speaker review before release.
- Pushy gamification → PRD §3 guardrails are acceptance criteria for Phase 4.
- OCR on handwriting → flag low-confidence questions first in teacher review.
- Child-data compliance → counsel review before pilot.

## Open items
- Replace P1–P3 with real names and confirm who has backend, frontend and AI strengths.
- Confirm who signs off at each gate (PRD author is listed as `@Taran`).
