# Frontend Continuation Prompt (paste into Antigravity / your coding agent)

> You are continuing the **Aaroh** web app in `apps/web` of the `stem3` repo (branch `develop`).
> The backend in `backend/` is real, tested and live. It already serves this app's own API contract
> through a compatibility layer at **`/web`**. Your job is to keep building the frontend **so it stays
> compatible with that backend**. The backend was adapted to your app, not the other way round, so
> **do not redesign the API from the frontend**. Read this whole prompt before changing code.

---

## 0. What exists today (verified live on 18 Nov 2026)

- `apps/web` (Next.js 16, React 19, TanStack Query, Zustand, next-intl, three.js farm) runs against the
  **real backend** with `NEXT_PUBLIC_USE_FAKES=false`. Fakes (MSW) still work with `=true`.
- Login works with the backend's **own phone OTP and tokens** (no Supabase) via
  `src/features/auth/backend-gateway.ts`, chosen automatically in `src/lib/create-services.ts` when
  `NEXT_PUBLIC_SUPABASE_URL` is empty.
- Verified in the browser: class-key login → farm → learning barn → lesson player (real questions from a
  teacher's uploaded notes) → answer checked by the server ("Correct"); teacher phone login → teacher
  dashboard with real classes, students, weak topics, class key and school consent.
- Backend checks: 38 live `/web` calls OK; 7 automated `/web` contract tests plus the full backend suite.

## 1. Run it

```bash
# terminal 1: backend (needs backend/.env from P1, never commit it)
cd backend
python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"
.venv/Scripts/python -m uvicorn app.main:app --port 8000
```
```bash
# terminal 2: web app
pnpm install
pnpm --filter @mooshala/web dev        # http://localhost:3000
```
`apps/web/.env.local`:
```
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/web
NEXT_PUBLIC_USE_FAKES=false
```
CORS allows `http://localhost:3000`, `http://localhost:5173`, `http://127.0.0.1:3000`. A deployed address
must be added to `WEB_ORIGINS` in `backend/.env` by P1.

### Demo accounts (backend `DEMO_MODE=true` only)
| Who | How to log in |
|---|---|
| Student (school computer) | Class key **`BI07-AARH`** + any name (same name = same student) |
| Teacher | Phone **`6000000099`**, code **`123456`** (no SMS is sent) |
| Classmates (league) | Meena `6000000101`, Arjun `…102`, Fatima `…103`, Kiran `…104`, code `123456` |
| Real phones | Real OTP by SMS (Twilio trial: only verified numbers) |

## 2. Non-negotiable rules (break these and the app silently stops matching the backend)

1. **Base URL is `/web`.** Every call goes through the generated client (`packages/api-client`) or the
   pending client, both rooted at `NEXT_PUBLIC_API_BASE_URL`. Never hard-code `/v1` paths; `/v1` is the
   backend's own API for other clients.
2. **The server owns every number.** XP, streak, hearts, gems, league, mastery, quest progress: display
   what the API returns after each call (`stats` comes back on attempt/complete). Never compute them.
3. **Students never get answers before answering.** `QuestionOut.content` has no `correct_index`/`answer`
   for students. The right answer arrives in `AttemptOut.correct_answer` *after* `POST /attempts`.
   Teachers *do* get answers in `GET /lessons/{id}` (same shape plus `correct_index` / `answer`).
4. **Don't invent endpoints or fields.** If a screen needs something missing: add it to the matching
   `packages/api-client/src/pending-*.ts` with a `// needs backend` note, make the MSW fake, list it in
   `docs/web/backend-handoff.md`, and ask P1. The backend will add it to `/web` in your shape.
5. **Keep fakes honest.** When the real backend returns a shape your MSW fake doesn't, fix the fake to
   match the real response (the backend is the source of truth for values; the contract is yours).
6. **Language mode** is only `hindi` or `kannada`; English always shows under the regional line.
   Content is always `{en, hi, kn}` (Tri).
7. **Say "Not quite", never "Wrong".** Every screen has loading, empty, error and success states.
8. **Product name is Aaroh**, not Mooshala (see section 6).

## 3. The `/web` contract: what the backend really returns

All shapes follow `packages/api-client/openapi/backend.json` and `src/pending-*.ts`. Notes below are the
places where real data has limits you must design for.

### Auth (not in the generated client)
| Call | Body → Response | Notes |
|---|---|---|
| `POST /auth/otp` | `{phone}` → `{sent, dev_code}` | `dev_code` only in demo with fake SMS; demo phones always return `123456` |
| `POST /auth/verify` | `{phone, code}` → `{access_token, token_type, expires_in}` | A **new** phone gets an unregistered account. Errors: `{"detail":{"code":"INVALID_CODE"|"OTP_EXPIRED"|"RATE_LIMITED"}}` |
| `POST /auth/class-key` | `{class_key, name}` → same session | Key with or without dash. `404 {"code":"KEY_NOT_FOUND"}` |

Tokens last **1 hour**; there is no refresh. On 401 send the user back to login (keep the class-key
session in sessionStorage as now). Onboarding: `GET /me` → `registered:false` → `PUT /me
{name, language_mode, roles}`. Only the **first** role in `roles` is stored (one role per account).

### Student
| Endpoint | Notes |
|---|---|
| `GET /me/home` | `continue_lesson` is the first unfinished lesson of the first published course; `classes[].subject` is the class subject; `new_lessons` is always 0 |
| `GET /me/courses`, `GET /courses/{id}/path` | `grade` is always 7 on courses; `is_personal:false`, `ai_made:true`; `generation_status:"ready"` |
| `POST /lessons/{id}/start` | Returns at most 8 questions (twin picks the weakest first). **Extra fields** on `lesson`: `kind` (`quiz|video|reading|interactive`) and `media` (`{video_url, transcript}` or `{reading}`). Show the media before the questions when present. Zero-question lessons exist: call complete after the media |
| Question types | `multiple_choice` (options are `{text: Tri}`, never `term_key`), `true_false` (`statement` holds the sentence), `match_pairs` (pairs come **in correct order: you must shuffle the right column**, as `seededOrder` already does). **`fill_formula` is never sent** (backend questions have no chips). `explanation` is always empty strings: hide the explanation box when empty |
| `POST /attempts` | Send the shapes in `content.ts` `answerPayload`. `correct_answer`: `{index}` / `{value}` / `{pairs}`. A wrong answer costs a heart (`heart_lost`). Answers under 1 s apart, or the 3rd repeat of a question, earn 0 XP (anti-cheat) |
| `POST /lessons/{id}/complete` | `409 "Answer every question correctly to finish"` until each served question was right once. Replaying a finished lesson gives XP and +1 heart but no gems/pot |
| Errors you must show nicely | `403` with detail **string** `"A parent or school must give consent first"` (show "waiting for your parent's OK"); `409` `"No hearts left…"` (offer practice/refill); `409` `"Finish the earlier lessons first"` |
| `GET /courses/{id}/terms`, saved terms | `key` is the English term slugged (`cell_wall`); `analogy` is empty; `source_page` 1 |
| `POST /doubts` | `answer` is the same text in en/hi/kn (Golu writes Hindi/Kannada + one English line). **`in_notes:false` means Golu refused** ("not in your notes"): style it as a gentle refusal. `source_pages` has the notes page when cited. 30 doubts/hour |
| `POST /audio` | `url` is absolute (plays from the backend). Cached; Hindi/Kannada voices are Sarvam |

### Game (`pending-game.ts`)
| Endpoint | Notes |
|---|---|
| `/game/stats` | `mascot.outfit` = equipped item; `owned` = outfits; `pending_pots` = unopened pot ids |
| `/game/shop`, buy, `PUT /game/mascot/outfit {outfit}` | 6 outfits (bow, cap, scarf, glasses, medal, cape), 30 gems each; `icon` = the outfit id. No decorations yet |
| `/game/quests` | Rewards are paid **when a quest completes**, so completed quests come back as `state:"claimed"`; `/claim` just returns it. Kinds used: `answer_questions`, `combo`, `finish_lessons` |
| `/game/league` | Members are first names/nicknames; `call_only` = learns by phone (show a phone icon) |
| `/game/badges` | ~43; `rule` repeats the name; `progress/goal` are null; `icon` = badge family (`lessons`, `streak`, `xp`…) |
| `/game/pots/{id}/open` | `reward.kind` gems / sticker / outfit |

### Teacher (generated + `pending-teacher.ts`)
| Endpoint | Notes |
|---|---|
| `POST /classrooms {name, subject, grade}` | Join keys are `BI07-K4X2` style (subject + grade + 4 chars from your alphabet) |
| `GET /classrooms/{id}`, `/dashboard`, `/students/{id}`, `/insights`, `/teacher/overview` | Real numbers from attempts and the Student Twin. `completion` and `trend` are 0/empty for now; `recent` activity is empty |
| Uploads | `POST /uploads {pages:[{kind}]}` → `pages[].upload_url` (null for text pages, whose `text` is stored at once) → **PUT the raw file** to each `upload_url` with `Content-Type` `image/jpeg|png|webp` or `application/pdf` (≤10 MB) and the bearer token → `POST /uploads/{id}/start` → poll `GET /uploads/{id}` every 1.5 s. Statuses: `created` → `queued` → `reading` → `outlining` → `ready` (or `failed` with `error`). Typical time 15–25 s (real Gemini) |
| `GET /courses/{id}`, `GET /lessons/{id}` (teacher view), `PUT /questions/{id} {question}`, `DELETE`, `/regenerate` | Flagged (low-confidence) questions first, `flag_reason:"low_confidence"`. Editing clears the flag. `PUT /courses/{id} {title}` stores one title (hi preferred) |
| `POST /lessons/{id}/publish {classroom_id?}` | **Publishing is per course in this backend**: the lesson's whole course goes live (and phone audio is pre-recorded). Show it as "Publish course" |
| `POST /courses/{id}/assign {classroom_ids}` | `due_at` is accepted but not stored yet |
| `/teacher/materials` | Built from uploads; files are named `page-N` |
| Class notes (`/teacher/notes`, `/me/notes`, `POST /classrooms/{id}/notes`) | **Not built in the backend**: GETs return `[]`, POST returns `501`. Show "coming soon" |

### Call console (`pending-calls.ts`)
| Endpoint | Notes |
|---|---|
| Create `{name, parent_phone, language, window, days}` | `parent_phone` is the phone that gets the calls. Window must be inside **09:00–21:00** (422 otherwise) |
| Status values | `waiting_consent` until the parent presses 1 on the consent call; then `scheduled` / `in_call` / `retry_pending` / `not_reachable` / `paused` / `cap_reached` (15 min/week) |
| `POST /call-students/{id}/call-now` | Real Twilio call (409 outside 9–9, without consent, paused, or over the cap) |
| `GET /call-students/{id}/twin` | `strong`/`weak` are concept names; `summary` is short English |

### Parent
`/me/link-code` (student) → `/parent/link/{code}` preview → `POST /parent/link` → `/parent/children`,
`/consent`, `/revoke-consent`, `DELETE` (unlink), **`/deletion` permanently deletes the child's data**
(confirm twice), `/dashboard` (week, accuracy, strongest/weakest concept, assignments, summary). A child
`id` is the backend learner id. `consent_status`: `approved | revoked | pending` (`approved` also when the
class has school consent).

### Not under `/web`
- Live updates: WebSocket `ws://<host>/v1/realtime?token=<access_token>` (events `xp`, `quest_tick`,
  `quest_done`, `league_move`, `badge`, `mascot`). Optional; REST already returns everything.
- The phone simulator and judges' console live at `/demo` on the backend, not in this app.

## 4. Build next (in this order)

1. **Rename Mooshala → Aaroh** (section 6). Keep storage keys that existing users rely on, or migrate them.
2. **Backend states**: consent-waiting screen (403), no-hearts sheet (409), finish-earlier-lessons,
   generic `{"detail": string | {code}}` errors, 401 → login, 503 "Golu is busy, try again".
3. **Video and reading lessons** using `lesson.kind` + `lesson.media` (video player + transcript with
   Listen; reading card with Listen), then the questions, then complete.
4. **Doubt chat polish**: refusal style for `in_notes:false`, "From your notes, page N" chip, limit counter.
5. **Teacher upload** against the real flow (section 3): per-page progress, statuses, failure message,
   open the review on `ready`, "Publish course".
6. **Call console** screens on the real data (statuses, Call now errors, twin card).
7. **Parent dashboard** on real data; deletion double-confirm.
8. **E2E against the real backend**: a Playwright project with `NEXT_PUBLIC_USE_FAKES=false` that logs in
   with the demo accounts and walks student, teacher and parent flows.
9. Hide or label anything section 3 says is not built (notes sharing, due dates, decorations).

## 5. Definition of done for every change
- Works with `NEXT_PUBLIC_USE_FAKES=false` against the real backend **and** with fakes.
- No new endpoint, field or path that isn't in section 3 unless P1 has added it to `/web`.
- Typecheck, lint, unit tests and the real-backend E2E pass; new strings in en/hi/kn (hi/kn as drafts in
  `docs/translations-to-review.md`).

## 6. Rename to Aaroh (team decision)
Package names (`@mooshala/*`), the page title, the logo text, `messages/*.json` strings, README and docs
say Mooshala; the product is **Aaroh** (आरोह / ಆರೋಹ). Keep the Golu mascot. Don't rename the backend.

## 7. Who to ask
Backend, data or a missing endpoint: **P1** (backend owner). The compatibility code is
`backend/app/routers/web_compat.py` (auth, student) and `web_compat_b.py` (game, calls, teacher, parent);
contract tests are `backend/tests/test_web_compat.py`.
