# Decisions
- M2: schema and RLS written as SQL files run by Alembic (not SQLAlchemy models); models are added per feature from M4. RLS tests run on the Supabase project in a rolled-back transaction.
- M3: backend issues its own HS256 tokens signed with SUPABASE_JWT_SECRET (sub = users.id). Direct Supabase-client RLS access only works if that secret matches the project's JWT signing key; revisit at deploy. Real SMS provider deferred to Phase 6 (fake SMS used).
- Prices the PRD leaves open: hearts refill 50 gems, outfit 30 gems (backend/app/game/rules.py).
- Mascot: calf to cow at 500 XP, cow to champion at 2,000 XP; 8,000 XP unlocks the "golden_meadow" scene.
- Quiet hours: a daily goal met after 9 pm IST still gives XP but does not extend the streak.
- Soft limit: after 45 minutes of play in a day, XP still counts for the student but not for the league.
- Anti-cheat: an answer less than 1 second after the previous one, or a 3rd+ repeat of a question in a lesson, earns no XP.
- Replaying a finished lesson counts as practice: XP and +1 heart, but no extra gems or pot.
- Consent gate: lessons need a granted consent (parent app, or school-wide flag on the class). The latest record wins, so a parent can revoke a school consent.
- Badge titles are English only for now; Hindi/Kannada titles come from P3's copy pass (log in translations-to-review.md).
- Realtime hub is in-process (one API instance); move to Redis or Postgres NOTIFY when scaling out.
- Badge checks run on lesson completion and on combos or comebacks, not on every answer, to keep requests fast.
- Hackathon: call mode runs on **Twilio** (instant trial) instead of Exotel (weeks to activate). The engine talks to a `TelephonyProvider` interface, so Exotel can replace Twilio later without changing the call logic.
- Twilio voices: Google `hi-IN-Standard-A` and `kn-IN-Standard-A` via TwiML <Say> (live text-to-speech, not pre-recorded Sarvam audio yet). Calls are never recorded.
- Call now is enforced inside 9 am to 9 pm IST; `CALL_HOURS_ENFORCED=false` exists only for testing on your own verified number.
- Key 0 ("simpler explanation") repeats the question for now; questions have no explanation field yet.
- The 5-minute scheduler, retries, missed-call callback and weekly SMS are not built yet (M10/M11 remainder).
- Parent SMS on course completion: sent once per course to linked parents (or a call student's parent phone), only with consent and outside 9 pm to 7 am IST; quiet-hour texts are marked queued_quiet until the M12 scheduler sends them. A failed SMS never undoes the lesson. Sent inline in the request (move after commit or to a job in M12).
- Demo console (/demo) and /v1/demo/* exist only with DEMO_MODE=true. /v1/demo/login gives the demo teacher's token without a password, so turn DEMO_MODE off after the hackathon (the tunnel URL is public).
- Questions now have a position, so lessons and calls play them in the order they were written.
- P3 AI: Gemini (Google AI Studio free tier) behind LLMProvider, model GEMINI_MODEL (default gemini-3.8-flash) with fallbacks; Google retired gemini-2.5-flash for new keys. Not open-source: swap for an open model after the hackathon. Free tier may use prompts for training, so only demo notes, never real student data.
- Gemini calls retry busy (429/5xx) and retired (404) models, but stop after an 80-second overall deadline so the app never hangs. Lite models (gemini-flash-lite-latest) come first: on 17 Nov 2026 the full flash models were overloaded while lite answered in about 1 s; a real notes photo became a course in 22.8 s.
- OCR is done by Gemini vision (photos and PDFs in one call) instead of Surya, for speed on a laptop.
- Notes upload pipeline runs as a FastAPI background task (Procrastinate job later). Course stays a draft; questions under 0.7 confidence, or from pages read under 0.7, are flagged for review.
- Doubt chatbot answers only from the class notes (OCR pages ranked by word overlap, plus terms) and cites the page; embeddings (BGE-M3) can replace the ranking later.
- Speech: Sarvam bulbul:v3 (speaker shubh), cached per text+language in audio_cache; files on local disk (UPLOAD_DIR) until Supabase Storage is wired.
- Call voice: Sarvam clips (8 kHz WAV) played with Twilio <Play>. Fixed lines are pre-recorded when a course is published (or with scripts/prewarm_calls.py); live lines are made in parallel within 7 s, and any slow or failed line falls back to Twilio <Say>. CALL_VOICE=twilio turns it off. Needs PUBLIC_BASE_URL so Twilio can fetch the clips.
- No canned demo courses: the demo seed creates only the class, the call student and classmates. Courses come from the teacher uploading real notes in the /demo console (upload, review flagged questions, publish to class).
- UI is desktop-first (team decision, 17 Nov 2026): no phone layout. This differs from the PRD (360 px phones). Students on phones, smart or basic, learn through call mode (scheduled calls, Call now, or dialling in).
- Scheduler (M10/M11): runs every SCHEDULER_INTERVAL seconds inside the API when SCHEDULER_ENABLED=true (one instance; Procrastinate job when scaling). Uses each session's scheduled time for "today". Weekly SMS goes to call-only students on Sunday after 6 pm IST; league reset runs on Mondays (idempotent).
- CORS: origins from WEB_ORIGINS for the teammate's desktop app; bearer tokens, no cookies.
- scripts/start_demo.py starts the API and tunnel, writes PUBLIC_BASE_URL, restarts the API and points the Twilio number in one command.
- Calling in without a Twilio number: the /demo console has a phone simulator. It runs the same call engine (POST /v1/demo/sim turns each step's TwiML into a script the browser plays), dials in from the demo student's number so caller ID works, and plays Sarvam clips. It lifts the 9 am to 9 pm rule because nothing real is called. Real dial-in still needs an owned number (Exotel/Twilio).
- Chatbot answers ONLY from the class notes: no related notes means a fixed reply without asking the AI; answers the AI marks as not-in-notes are discarded; every answer is fact-checked against the same notes by a second AI call; an answer must cite a real page or term. Off-topic and general-knowledge questions get the fixed reply in the student's language.


## Mooshala Web frontend added (frontend-sandra)
- The web app (apps/web), its design tokens and API client (packages/tokens, packages/api-client) were brought over from the earlier `stem` repo, where they were built and tested. Planning and handoff notes are in docs/web/.
- The web app runs on its built-in fake backend (`NEXT_PUBLIC_USE_FAKES=true`). Its API types were generated from the `stem` backend's contract, which has no `/v1` prefix. This repo's packages/api-client/openapi.json (with `/v1`) is kept as is. Pointing the web app at this backend means regenerating the client from it; see docs/web/backend-handoff.md.
- docs/translations-to-review.md now holds the full list of Hindi/Kannada drafts the web app uses.
- Web app integration (18 Nov 2026): the backend adapts to apps/web, not the reverse. A compatibility layer at /web (web_compat.py, web_compat_b.py) serves the web app's own contract on top of the real logic; the frontend only changed its base URL and login adapter (backend OTP instead of Supabase). Join keys now use the web format (BI07-K4X2, no 0/O/1/I/L). Demo accounts moved to +91 6000000099 etc. (demo code 123456). Answer attempts use the real clock like consent records.
- OTP SMS failures never crash login: 503 SMS_UNAVAILABLE normally; in DEMO_MODE the code falls back to 123456. The Twilio trial rejects custom SMS text (error 572006: trial accounts can only use predefined templates), so real OTP and parent texts need an upgraded Twilio account or an Indian SMS provider with DLT templates.

## Farm worlds, Farm Store and placement (web)
- Five explorable fields (Starter Meadow, Blossom Meadow, Golden Valley, Woodland Farm, Mountain Paradise) unlock at 0 / 2,000 / 4,000 / 6,000 / 8,000 XP, taken from the product owner's Meadow Levels design; this fits the PRD's 2,000 and 8,000 XP milestones.
- 3D models are CC0 packs from Quaternius and Kenney, converted to optimised GLB (apps/web/public/models/world, credits in CREDITS.md there). Terrain, water, grass, wind and animal motion are procedural.
- Gems are the store currency (the design's "coins"). Prices are scaled to real earnings (5 gems per lesson): 6 to 200 gems.
- The world endpoints (/world, /world/store, /world/inventory, /world/fields/{id}/layout) are served by the fake backend only; see docs/web/backend-handoff.md. Purchases use an Idempotency-Key; layouts are saved whole with a version number (409 LAYOUT_CONFLICT if changed elsewhere).
- Placement rules (inside the field, not on water, paths, steep ground, buildings or other objects) live in apps/web/src/lib/world/placement.ts and are checked both in the editor and by the fake server.
- Golu in the new world is the farm cow model at a size that grows with the mascot stage; the old outfit accessory is not shown on it yet.
- Teacher and parent dashboards do not show field progress yet, because their API responses have no total XP. The store and editing are student-only (other roles get 403 NOT_A_STUDENT).
- The unlock celebration is a pop-up card with a sound, not a cinematic camera move.
- The old primitive farm (src/three/world/FarmWorld.tsx) is kept for its scene tests; the student farm now renders src/three/worlds/WorldScene.tsx.
