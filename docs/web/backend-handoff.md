# Backend handoff for Mooshala Web

Nov 17, 2026

This note is for whoever builds the backend that the web app will connect to. It lists what the web app (`apps/web`) already calls, what it assumes about endpoints that don't exist yet, and how to keep the two in sync.

## How the frontend stays in sync

The web app's API types are generated from the backend's own OpenAPI document, so they can't drift silently:

```
cd packages/api-client
pnpm export-openapi   # runs the FastAPI app and writes openapi/backend.json (needs backend/.venv)
pnpm generate         # regenerates src/generated/backend.ts
```

If a backend change breaks a screen, `pnpm typecheck` fails and points at it. The fakes used in development and tests (`apps/web/src/mocks/handlers.ts`) are typed against the same schemas.

Errors must keep the existing format: `{"detail": {"code": "SOME_CODE"}}` with the HTTP status from `backend/app/errors.py`. The web app turns each code into a bilingual message (`apps/web/messages/*.json`, `errors` namespace). A new code needs a line there.

## Endpoints the web app uses today (they already exist)

| Call | Used for |
| --- | --- |
| `GET /me` | Profile after sign-in: `registered`, `name`, `roles`, `language_mode` decide where the user goes |
| `PUT /me` | New users: name, language and role from onboarding |
| `GET /classrooms` | Teacher shell class switcher |
| `GET /classrooms/preview/{key}` | Join a class: preview, including the join errors |
| `POST /classrooms/join` | Join a class |
| `GET /me/home`, `GET /me/stats`, `PUT /me/daily-goal` | Farm HUD, signboard, daily goal (Phase 2) |
| `GET /courses/{id}/path` | Lesson markers on the farm path, `/farm/learn` |
| `POST /lessons/{id}/start`, `GET /lessons/{id}` | Lesson player (GET when resuming an interrupted lesson, so the attempt window isn't reset) |
| `POST /attempts`, `POST /lessons/{id}/complete` | Grading, XP, hearts, streak |
| `GET /courses/{id}/terms`, `PUT/DELETE /me/saved-terms/{course_id}/{key}` | Word book |
| `POST /doubts`, `POST /audio` | Doubt chat, listen buttons |

Every call sends `Authorization: Bearer <Supabase access token>`, which the backend already verifies (`backend/app/auth.py`).

## Phone OTP: nothing to build

The web PRD lists `POST /auth/otp` and `POST /auth/verify`, but the backend doesn't have them, and the Android app doesn't need them either: both apps sign in with **Supabase phone OTP** directly (`signInWithOtp`, then `verifyOtp` with `type: "sms"`), and the backend verifies the resulting JWT. The web app does the same, so phone login works against the real backend as soon as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set.

If the backend later wants to own OTP (for example to send SMS through Exotel), tell the frontend; it means one new class implementing `AuthGateway` (`apps/web/src/features/auth/gateway.ts`).

## Class key + name login: please build `POST /auth/class-key`

Shared school computers sign a student in with the class key and their name (web PRD section 2, "Login is by phone code (OTP), or by a class key and a name"). The PRD names the path but not the payloads, so the web app assumes the shape below. **Building it exactly like this means no frontend change.**

### Request

```http
POST /auth/class-key
Content-Type: application/json

{ "class_key": "BI09-K4X2", "name": "Ravi" }
```

- `class_key`: the classroom join key, already normalised by the app to `XXXX-XXXX` uppercase (same format and alphabet as `classrooms.join_key`, docs/PRD.md M1).
- `name`: 1 to 60 characters, trimmed, single spaces.
- No `Authorization` header (the student isn't signed in yet).

### Success: `200 OK`

```json
{ "access_token": "<JWT>", "token_type": "bearer", "expires_in": 28800 }
```

- `access_token` must be accepted by `get_current_user`, so every existing endpoint works with it. The simplest way is a JWT with `aud=authenticated`, `sub=<user id>`, `exp`, signed with the same key the backend already checks (HS256 `SUPABASE_JWT_SECRET`), or a Supabase session minted with the service role.
- The user behind it must look like any student to `GET /me`: `registered: true`, `roles: ["student"]`, a `language_mode` the class allows, and an active membership in that class. The same key plus the same name should return the same student again (the app relies on this to sign a student back in).
- `expires_in` is in seconds; 8 hours (one school day) is suggested. The app keeps this session in `sessionStorage`, so closing the browser signs the student out.

### Errors (same format as every other endpoint)

| Status | `detail.code` | App shows |
| --- | --- | --- |
| 404 | `KEY_NOT_FOUND` | "No class has this key" |
| 410 | `KEY_EXPIRED` | same message |
| 429 | `TOO_MANY_ATTEMPTS` | "Too many tries" (please rate limit per IP and per key; there's no user yet) |
| 422 | (FastAPI validation) | generic message |

Until the endpoint exists, a real backend answers 404 without a code, and the app shows "This way of signing in isn't ready yet. Use a phone number." It never fakes success.

### Open questions for the backend

- Should a name collision in the same class (two "Ravi"s) be allowed, or should the response ask for a second detail? The app currently has no second field.
- Consent: a class-key student still needs the DPDP consent gate before lessons (school-wide consent, `PUT /classrooms/{id}/school-consent`, already covers this).

If you choose a different shape, only `apps/web/src/features/auth/class-key.ts` and `packages/api-client/src/pending-auth.ts` change; once the endpoint is in `openapi/backend.json`, delete `pending-auth.ts` and use the generated types.

## Prefix

The web PRD says "REST under /v1". The current backend serves routes at the root (`/me`, not `/v1/me`). The web app uses whatever `NEXT_PUBLIC_API_BASE_URL` points at, so adding `/v1` later only means setting the base URL to `https://api.example/v1`.


## Game endpoints the web app mocks (Phase 2 onwards): please build

The web spec names `GET /game/stats`, `GET /game/quests`, `GET /game/league`, `POST /game/pots/{id}/open`, `POST /game/freeze` and `GET /game/badges` without payloads. The web app's assumed payloads are typed in `packages/api-client/src/pending-game.ts` and served by the fakes in `apps/web/src/mocks/game/`. Errors use the usual `{"detail": {"code": ...}}` form.

| Call | Status | Body |
| --- | --- | --- |
| `GET /game/stats` | spec | `GameStats`: `gems`, `freezes`, `max_freezes`, `freeze_cost`, `mascot {stage, xp_total, next_stage_xp, outfit}`, `owned[]`, `pending_pots[]` |
| `POST /game/freeze` | spec | → `GameStats`; errors `NOT_ENOUGH_GEMS`, `FREEZES_FULL` |
| `GET /game/shop` | assumed | `ShopItem[]`: `id`, `kind` (outfit or decoration), `name {en,hi,kn}`, `icon`, `price`, `owned` |
| `POST /game/shop/{item}/buy` | assumed | → `GameStats`; errors `NOT_ENOUGH_GEMS`, `ALREADY_OWNED` |
| `PUT /game/mascot/outfit` | assumed | `{outfit: string or null}` → `GameStats` |

Numbers from the spec the server should apply: 5 gems per finished lesson, 20 per quest, 50 per badge, a streak freeze costs 100 gems and at most two are stored, the gems ledger is append-only. Shop prices in the mock are placeholders.

### Phase 4 additions (game layer)

| Endpoint | Status | Shape |
|---|---|---|
| `GET /game/quests` | spec | `Quest[]`: `id, period daily|weekly, kind, title Tri, progress, goal, reward_gems, state active|complete|claimed, ends_at` |
| `POST /game/quests/{id}/claim` | assumed | → `{quest, stats: GameStats}`; errors `ALREADY_CLAIMED`, `QUEST_NOT_COMPLETE` (409) |
| `GET /game/league` | spec | `League`: `enabled, tier, week_ends_at, promote_count, demote_count, members[{rank, name, weekly_xp, is_self, call_only}]`, ranked by weekly XP only |
| `GET /game/badges` | spec | `Badge[]`: `id, name Tri, rule Tri, icon, earned_at, progress, goal` |
| `POST /game/pots/{id}/open` | spec | → `{pot_id, reward {kind gems|sticker|outfit, amount, item}, stats}`; `POT_ALREADY_OPENED` (409). Contents fixed per pot on the server. |



## Call-mode endpoints the web app mocks (Phase 5): please build

The web expects these call-mode endpoints (contract in `packages/api-client/src/pending-calls.ts`; the reference behaviour is the fake in `apps/web/src/mocks/calls/`):

- `GET /classrooms/{id}/call-students` returns `CallStudent[]`. The teacher must own the classroom.
- `POST /classrooms/{id}/call-students` takes `{name, parent_phone, language, window:{start,end}, days}`, with "HH:MM" times in IST. It returns 201 `CallStudent`, or one of:
  - 422 VALIDATION, for a phone that isn't +91 plus 6–9 and 9 digits, a window outside 09:00–21:00 or shorter than 30 minutes, or Sunday
  - 409 DUPLICATE_PHONE
  - It starts the consent call or SMS to the parent, so the status starts as `waiting_consent`.
- `PATCH /call-students/{id}` takes `{paused?, language?, window?, days?}` and returns `CallStudent`.
- `POST /call-students/{id}/call-now` returns 202 `CallSession` with state `dialing`, or 409 with one of CALL_IN_PROGRESS, CALLS_PAUSED, CONSENT_PENDING, WEEKLY_CAP_REACHED or OUTSIDE_CALL_HOURS (checked in that order). It must never return `connected` synchronously.
- `GET /call-students/{id}/call` returns the latest `CallSession`. State only moves forward: dialing, then ringing, then connected, then completed, no_answer or failed. On no_answer it sets `retry_at` 20 minutes later, for at most 2 retries, then the student becomes `not_reachable`.
- `GET /call-students/{id}/twin` returns `CallTwin` (lessons_heard, last_topic, strong, weak, and summary as en/hi/kn).
- `CallStudent` exposes only `phone_last4`, never the full number. `minutes_this_week` resets Monday 00:00 IST, and `weekly_cap_minutes` is 15.


## Offline sync (Phase 6): please support `Idempotency-Key`

The web app replays answers saved offline. `POST /attempts` and `POST /lessons/{id}/complete` may carry an `Idempotency-Key` header (a UUID).
- For the same user and key, run the request once, store the 2xx response, and return it unchanged on every replay (XP, hearts, streak and lesson bonus are paid once).
- Don't store error responses, so a refused request can be retried.
- Add `Idempotency-Key` to the CORS allowed headers.
- Accept attempts that arrive late, after the lesson was started, in the order sent. The app sends a completion only after that lesson's answers.


## Teacher analytics and materials (connected modes): please build

The contracts are in `packages/api-client/src/pending-teacher.ts`, and the fakes are in `apps/web/src/mocks/teacher/state.ts`.
- `GET /teacher/overview` returns `TeacherOverview`, the teacher's non-expired classes.
- `GET /classrooms/{id}/insights` returns `ClassInsights`. The teacher must own the classroom.
- `GET /teacher/materials` returns `Material[]`, the teacher's own uploads, with per-page file name and kind, class, and status (draft, processing, review or published).
- Please add an optional `file_name` to `PageIn` and keep it per page.

## Class notes (pending)
- `POST /classrooms/{id}/notes` (teacher who owns the class) with `{title, body?, file?: {name, type, data_url}}` → 201 `ClassNote`. Needs a title and either text or a file; 422 `VALIDATION`, 413 `FILE_TOO_LARGE`.
- `GET /teacher/notes` → the teacher's notes, newest first. `GET /me/notes` → notes from the classes the caller is a member of.
- Types are in `packages/api-client/src/pending-notes.ts`. Store files in object storage and return a signed `url`.
