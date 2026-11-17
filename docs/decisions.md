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

## Mooshala Web frontend added (frontend-sandra)
- The web app (apps/web), its design tokens and API client (packages/tokens, packages/api-client) were brought over from the earlier `stem` repo, where they were built and tested. Planning and handoff notes are in docs/web/.
- The web app runs on its built-in fake backend (`NEXT_PUBLIC_USE_FAKES=true`). Its API types were generated from the `stem` backend's contract, which has no `/v1` prefix. This repo's packages/api-client/openapi.json (with `/v1`) is kept as is. Pointing the web app at this backend means regenerating the client from it; see docs/web/backend-handoff.md.
- docs/translations-to-review.md now holds the full list of Hindi/Kannada drafts the web app uses.

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
