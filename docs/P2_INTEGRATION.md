# Aaroh: Frontend Integration Guide (for P2)

> **Building `apps/web`?** Use `docs/FRONTEND_PROMPT.md` and the `/web` compatibility layer. This guide
> describes the backend's own `/v1` API (used by the demo console, phone calls and other clients).

This is everything the student, teacher and parent app needs from the backend in `stem3/backend`.
The backend serves **both kinds of students** with one system:

| | Student on a computer (your app) | Student on a phone (any phone) |
|---|---|---|
| Learns by | Your screens (desktop/laptop/school PC) | Keypad phone call (backend + Twilio), or dialling Aaroh's number |
| Courses | Same courses, made from the teacher's notes | Same |
| Student Twin, XP, streak, hearts, league, badges | Same server-side numbers | Same (shown "by phone" in the league) |

**Team decision (17 Nov 2026):** the app is **desktop-first**; no phone layout is required. Students on phones
(smartphone or basic) learn through call mode, which already works end to end.

Rules from the PRD that the screens must follow:
- **The server owns every number** (XP, streak, hearts, league, mastery). Never compute them in the app; show what the API returns.
- **Answers are checked only by the server** (`POST /v1/attempts`). The app never receives the right answer before the child answers.
- Every screen shows the **regional line in bold with English underneath**, in the **stored language mode** (Hindi or Kannada), never the browser's.
- Say **"Not quite"**, never "Wrong". Every screen needs loading, empty, error and success states.

The full machine-readable contract is `packages/api-client/openapi.json` (generate a typed client from it). Interactive docs: `http://127.0.0.1:8000/docs` while the API runs.

---

## 1. Basics

| Item | Value |
|---|---|
| Base URL (local) | `http://127.0.0.1:8000` (all routes start with `/v1`) |
| Public URL (demo) | the Cloudflare tunnel in `backend/.env` → `PUBLIC_BASE_URL` (changes on restart) |
| Auth | `Authorization: Bearer <access_token>` from login. Token lasts 1 hour (`expires_in`). |
| Errors | JSON `{"detail": "<message>"}`. 401 = log in again. 403 = wrong role or **no consent**. 404 = not found or not yours. 409 = not allowed right now (see message). 422 = bad input. 429 = too many tries. 503 = AI or speech busy, try again. |
| Roles | `student`, `teacher`, `parent` (`admin` exists, not self-assignable) |
| CORS | Allowed origins come from `WEB_ORIGINS` in `backend/.env` (comma-separated; default `http://localhost:3000`, `http://localhost:5173`, `http://127.0.0.1:3000`). Ask P1 to add your deployed address. |

### Language of content
Content fields come as objects like `{"hi": "...", "kn": "...", "en": "...", "regional": "...", "english": "..."}` or as plain strings. Pick in this order: the user's language key (`hi`/`kn`/`en`) → `regional` (or `english` for en) → `english` → plain string. Show the English line underneath.

---

## 2. Login and onboarding

| Step | Call | Body → Response |
|---|---|---|
| Send OTP | `POST /v1/auth/otp` | `{"phone": "9876543210"}` → `{"sent": true, "dev_code": null}`. `dev_code` holds the code only in local demo mode with fake SMS. Rate limited (5 per phone per hour). |
| Verify | `POST /v1/auth/verify` | `{"phone", "code": "123456", "role"?, "name"?, "language"?: "hi"\|"kn"\|"en"}` → `{"access_token", "token_type": "bearer", "expires_in": 3600, "user": {"id", "role", "language", "name"}}`. New phone numbers **must** send `role` and `name`. |
| School computer login | `POST /v1/auth/class-key` | `{"class_key": "BI07AARH", "name": "Ravi"}` → same session shape. Same name in the same class = same student (fast switching). |
| Who am I | `GET /v1/auth/me` | → `{"id", "role", "language", "name"}` |
| Join a class (student) | `POST /v1/classrooms/join` | `{"class_key": "ABCD2345"}` → `{"classroom_id", "name"}`. Use this for key, QR code and link joins (put the key in the QR/link). |

**Consent gate:** a student can only start lessons when a parent gave consent (parent app or phone key press) or the school turned on class-wide consent. Otherwise lesson calls return **403 "A parent or school must give consent first"**. Show a friendly "Waiting for your parent's OK" screen.

---

## 3. Student: home and learning path

`GET /v1/home` →
```json
{"stats": {"xp": 47, "streak": 1, "hearts": 4, "gems": 75, "daily_goal": 20, "today_xp": 47,
           "freezes": 0, "stage": "calf", "league_tier": "bronze"},
 "continue": {"course_id", "course_title", "lesson_id", "lesson_title"} | null,
 "courses": [{"id", "title"}]}
```
`continue` is the Continue card. `courses: []` means "join a class".

`GET /v1/courses/{course_id}/path` →
```json
{"id", "title", "subject": "biology|chemistry|physics",
 "units": [{"id", "title", "lessons": [{"id", "title", "kind": "quiz|video|reading|interactive",
                                         "state": "completed|current|locked"}]}]}
```
Only one lesson is `current`; later ones are `locked`. Starting a locked lesson returns 409.

`GET /v1/game/stats` → the same `stats` object (for the top bar). `GET /v1/twin/concepts` → `[{"concept", "mastery": 0..1, "stars": 0..3, "next_review"}]` (mastery stars).

---

## 4. Student: the lesson player

### 4.1 Start
`POST /v1/lessons/{lesson_id}/start` (no body) →
```json
{"lesson": {"id", "title", "kind": "quiz|video|reading|interactive", "content": {...}},
 "questions": [{"id", "kind": "mcq|true_false|match|fill_in", "prompt": {...}, "options": [...] | null,
                "concept": "cell" | null, "call_safe": true}]}
```
- Calling start again restarts the lesson (replay = practice).
- 409 "No hearts left" when hearts are 0 → show the practice / refill option.

**Lesson kinds (maps to the P2 prompt's LessonType):**

| P2 prompt | `kind` | `content` | What to show |
|---|---|---|---|
| QUIZ | `quiz` | `{}` or `{"body": {hi,kn,en}}` (a short reading made by the AI) | Questions one by one |
| VIDEO | `video` | `{"url": "https://...mp4", "transcript": {hi,kn,en}}` | Video + transcript, then any questions, then complete |
| READING | `reading` | `{"body": {hi,kn,en}}` | Text + Listen, then any questions, then complete |
| INTERACTIVE | `interactive` | `{}` | Questions of kind `match` as a tap-to-pair game |

Video/reading lessons may have **zero questions**: call complete straight after the content.

### 4.2 Answer (server checks it)
`POST /v1/attempts` with `{"question_id", "answer": <see table>}` →
```json
{"correct": true, "first_try": true, "feedback": "correct|not_quite", "correct_answer": <answer>,
 "xp_gained": 12, "combo": 3, "hearts": 5, "suspicious": false,
 "badges"?: ["perfect_1"], "quests_completed"?: ["answer_10"]}
```

| Question `kind` | What to send as `answer` |
|---|---|
| `mcq` | the chosen option **exactly as it came** in `options` (string or object) |
| `true_false` | `true` or `false` |
| `fill_in` | the typed string (case and spaces are ignored) |
| `match` | an object pairing items: `options` is `[left..., right...]` (first half left, second half right, rights shuffled). Send `{ key(left): key(right) }` where `key(x)` = the string itself, or `JSON.stringify(x)` (compact, no spaces) for objects. |

- Wrong answers cost 1 heart; put the question back at the end of the queue (PRD: "wrong answers return at the end").
- `correct_answer` is only sent **after** answering, for the "Not quite, the answer is…" line.
- Answers faster than 1 second apart, or a 3rd+ repeat of a question, earn 0 XP (`suspicious: true`).
- The lesson must be started first (409 otherwise).

**P2 prompt contract mapping:** `questionText` → `prompt`; `options` → `options`; `correctAnswer` → **not sent before answering** (anti-cheat; comes back as `correct_answer` after an attempt); `explanation` → **not available yet** (ask P1/P3 if needed).

### 4.3 Complete
`POST /v1/lessons/{lesson_id}/complete` → (409 until every question was answered correctly at least once)
```json
{"xp_gained": 30, "perfect": true, "gems_gained": 5, "practice": false,
 "stats": {...}, "badges"?: [...], "quests_completed"?: [...], "pot_id"?: "uuid",
 "mascot_stage"?: "cow", "course_completed"?: {"course_id", "parent_sms": "sent|queued_quiet|no_parent|no_consent|failed"}}
```
- `practice: true` = a replay: +1 heart, no gems, no pot.
- Show the celebration: XP, accuracy, best combo, badges, quests, then the **Golu Pot** if `pot_id` is present.

### 4.4 Terms, doubts, Listen
| Feature | Call |
|---|---|
| Course glossary | `GET /v1/courses/{course_id}/terms` → `[{"id", "regional", "english", "definition": {hi,kn,en} | null, "saved": bool}]` |
| Save / unsave a term | `POST` / `DELETE /v1/terms/{term_id}/save` (204) |
| Saved terms | `GET /v1/me/saved-terms` |
| Ask a doubt | `POST /v1/doubts` `{"text", "lesson_id"?}` → `{"id", "answer", "citation": {"course", "page"} \| {"course", "term"} \| null}`. Show the citation as a SourceChip ("From your notes: page 2"). 503 = "Golu is busy, try again". Max 30 per hour. |
| Doubt history | `GET /v1/doubts` → last 30, newest first. **Only the student sees doubts** (teachers and parents get nothing). |
| Listen (Hindi/Kannada voice) | `POST /v1/audio` `{"text", "language": "hi|kn|en"}` → `{"id", "url": "/v1/audio/<id>"}`. Play `url` in an `<audio>` tag (no auth header needed). Cached, so repeat calls are instant. |

---

## 5. Student: game layer

| Screen | Call |
|---|---|
| Quests | `GET /v1/game/quests` → `[{"code": "answer_10|combo_3|lesson_1|lessons_5|revision_5", "kind": "daily|weekly|revision", "target", "gems", "progress", "completed", "concepts"?}]`. The revision quest only appears when the twin has fading concepts (double gems). |
| League | `GET /v1/game/league` → `{"enabled", "tier", "xp", "rank" \| null, "week_start", "promote_zone": 3, "demote_zone": 3, "pod": [{"rank", "name", "xp", "is_call", "me"}]}`. Show the student's own row first/highlighted; `is_call` = phone icon. `enabled: false` = teacher switched leagues off. |
| Badges / trophy shelf | `GET /v1/game/badges` → `[{"code", "title": {"en", "hi"?, "kn"?}, "earned", "awarded_at"}]` (about 43) |
| Golu Pot | `POST /v1/game/pots/{pot_id}/open` → `{"reward": {"type": "gems|sticker|outfit", "amount"?, "item"?}, "gems"}` (409 if already open) |
| Mascot | `GET /v1/game/mascot` → `{"stage": "calf|cow|champion", "outfit": {"owned": [...], "stickers": [...], "scenes": [...]}, "xp", "next_unlock_at_xp"}` |
| Spend gems | `POST /v1/game/freeze` (100 gems, max 2), `POST /v1/game/hearts/refill` (50), `POST /v1/game/outfits/buy` `{"item": "bow|cap|scarf|glasses|medal|cape"}` (30) |
| Settings | `PATCH /v1/game/settings` `{"daily_goal"?: 20\|50\|100, "league_opt_out"?: bool, "nickname"?: string}` |
| Parent link code | `POST /v1/me/link-code` → `{"code"}` (valid 7 days, one use) |

**Live updates:** WebSocket `ws://<host>/v1/realtime?token=<access_token>` sends JSON events:
`{"type": "xp", "xp", "total"}`, `{"type": "quest_tick"|"quest_done", "code", ...}`, `{"type": "league_move", "rank", "from"}`, `{"type": "badge", "code"}`, `{"type": "mascot", "stage"}`, `{"type": "lesson_complete", "xp"}`. Optional: the REST responses already contain everything.

Healthy-play rules are enforced by the server (quiet hours 9 pm to 7 am for streaks, 45-minute soft limit for the league). If you show a "time for a break" message, base it on your own session timer.

---

## 6. Teacher screens

| Screen | Call |
|---|---|
| Classes | `POST /v1/classrooms` `{"name"}` → `{"id", "name", "class_key"}`; `GET /v1/classrooms`; `PATCH /v1/classrooms/{id}` `{"league_enabled"?, "school_consent"?}` |
| **Upload notes → course (AI)** | `POST /v1/uploads` as `multipart/form-data`: `files` (1–20 JPG/PNG/WEBP/PDF, ≤10 MB each), `language` (`hi|kn|en`), `class_level` (6–10). → `202 {"upload_id", "status": "processing", "files"}`. Poll `GET /v1/uploads/{id}` every 1–2 s → `{"status": "processing|ocr|outline|done|failed", "course_id", "error", "elapsed_ms", "pages", "ocr_confidence", "flagged_questions"}`. Typical time: 15–25 s. |
| Review | `GET /v1/courses/{id}` → units → lessons (with `kind`, `content`) → questions (**flagged first**, each with `answer`, `flagged`, `call_safe`). Teachers see answers; students never do. |
| Edit / delete / regenerate | `PATCH /v1/questions/{id}` `{"prompt"?, "options"?, "answer"?, "concept"?, "call_safe"?, "flagged"?}` (editing clears the flag); `DELETE /v1/questions/{id}`; `POST /v1/questions/{id}/regenerate` (AI writes a replacement) |
| More questions | `POST /v1/lessons/{id}/generate` `{"count": 1..12}` → `{"added"}` (AI, for later lessons) |
| Manual course | `POST /v1/courses` `{"title", "subject"}` then `POST /v1/courses/{id}/content` `{"units": [{"title", "lessons": [{"title", "kind", "content", "questions": [...]}]}], "terms": [...]}` |
| Publish + assign | `POST /v1/courses/{id}/publish` (needs ≥1 question; also pre-records phone audio), then `POST /v1/courses/{id}/assign` `{"classroom_id"}` |
| Dashboard | `GET /v1/classrooms/{id}/dashboard` → `{"name", "league_enabled", "school_consent", "students": [{"learner_id", "name", "is_call", "call_status", "xp", "streak", "last_active", "idle"}], "idle_students", "call_only_students", "weak_topics": [{"concept", "avg_mastery", "learners"}]}` |

### Call mode (teacher call console)
| Screen | Call |
|---|---|
| Add student without the app | `POST /v1/classrooms/{id}/call-students` `{"name", "phone", "language": "hi|kn", "call_days"?: [1..7], "window_start"?: "17:00:00", "window_end"?: "19:00:00", "parent_phone"?}` → `{"id", "learner_id", "status": "waiting_consent"}`. Window must be inside 9 am to 9 pm. |
| List | `GET /v1/classrooms/{id}/call-students` → `[{"id", "name", "phone_e164", "language", "call_days", "window_start", "window_end", "status"}]` (`waiting_consent|active|paused|not_reachable|declined`) |
| Edit / pause | `PATCH /v1/call-students/{id}` `{"language"?, "call_days"?, "window_start"?, "window_end"?, "parent_phone"?, "paused"?: bool}` |
| Call now | `POST /v1/call-students/{id}/call-now` → `{"session_id", "kind": "consent|lesson", "status": "ringing"}`. 409 outside 9 am to 9 pm, without consent, paused/declined, or over the 15-minute weekly cap. |
| Twin card | `GET /v1/call-students/{id}/twin` → `{"name", "status", "weak_concepts": [{"concept", "mastery"}], "next_lesson", "recent_calls": [{"status", "created_at", "seconds_used"}]}` |
| Parent code for a call student | `POST /v1/call-students/{id}/link-code` → `{"code"}` |

Students without the app can also **call the Aaroh number** themselves; caller ID finds their course. That needs no frontend work.

---

## 7. Parent screens

| Screen | Call |
|---|---|
| Link a child | `POST /v1/parent/link` `{"code"}` → `{"learner_id"}` (code from the student's profile or the teacher) |
| Children (switch) | `GET /v1/parent/children` → `[{"learner_id", "name", "is_call"}]` |
| Weekly summary | `GET /v1/parent/children/{learner_id}/summary` → `{"xp_this_week", "lessons_this_week", "days_active", "streak", "accuracy" \| null, "concepts_to_revise", "consent"}`. Never contains doubt text. "Listen to summary": build a sentence and use `POST /v1/audio`. |
| Consent | `POST /v1/parent/consent` `{"learner_id", "granted": bool}` |
| Delete my child's data | `POST /v1/parent/deletion` `{"learner_id"}` → `{"status": "done"}`. Permanent: confirm twice in the UI. |

---

## 8. Not available yet (ask P1 before building against it)

- Notifications inbox and web push subscription endpoints (Phase 6).
- Offline sync endpoints: cache the current lesson in a service worker; attempts must still go to the server.
- Admin console APIs (schools, moderation, call costs).
- Question `explanation` text.
- Voice answers / voice doubts (P2 in the PRD: "coming later").

## 9. Running the backend locally

```bash
cd backend
python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"
uvicorn app.main:app --port 8000
```
Ask P1 for a `backend/.env` (never commit it). With `USE_FAKE_*=true` everything runs without real keys; `DEMO_MODE=true` returns OTP codes in the API response for local testing.
