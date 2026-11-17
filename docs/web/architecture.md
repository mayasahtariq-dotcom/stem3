# Aaroh Web: Phase 1 architecture

Nov 17, 2026

How the web app is put together, so Phases 2 to 6 can build on it. The product spec is the Aaroh Web PRD (uploaded to the project); the phase plan is `docs/web/p2-frontend-plan.md`.

## Repository layout

The repository already held the Android app (`app/`) and the FastAPI backend (`backend/`). Phase 1 adds a pnpm workspace beside them without touching either:

```
package.json, pnpm-workspace.yaml, turbo.json   workspace root (pnpm 10 + Turborepo)
packages/tokens/       design tokens: src/index.ts (source of truth) -> tokens.css (generated Tailwind @theme)
packages/api-client/   openapi/backend.json (exported from FastAPI) -> src/generated/backend.ts + openapi-fetch client
apps/web/              Next.js 16 App Router, React 19, TypeScript strict
  messages/            en.json, hi.json, kn.json
  public/models/       GLB farm models; public/sounds/ UI sounds; public/mockServiceWorker.js (MSW)
  scripts/             art extraction, GLB and sound generators
  e2e/                 Playwright specs
  src/app/             routes: (auth) (student) (teacher) (parent), layout, error boundaries
  src/components/ui/   design-system components + stories
  src/features/        auth, onboarding, classroom, shell, farm  (UI state + screens per feature)
  src/three/           3D engine: config, engine (scene host, quality, lifecycle), assets, world
  src/lib/             env, api (client, errors, query client, keys), i18n, store, sound, motion, errors
  src/mocks/           MSW fake backend (typed against the OpenAPI schemas)
  src/test/            Vitest setup and helpers
```

## Layers

| Layer | Where | Rule |
| --- | --- | --- |
| UI (stateless screens, components) | `components/ui`, `features/*/*Screen.tsx` | Props in, events out. No fetching, no business rules. |
| Screen state ("view-models") | `use*Screen` / `use*Login` hooks next to each screen | Validation, calling services, navigation. Plain state objects, so screens are previewable and testable. |
| Server state | TanStack Query hooks (`features/*/api.ts`, `features/auth/hooks.ts`) | All backend data. Keys live in `lib/api/query-keys.ts`. |
| Client state | Zustand: `lib/store/app-store.ts` (persisted device choices), `features/auth/auth-store.ts` (session status) | Never server numbers. XP, streaks, hearts and leagues come from the server only. |
| Data access | `lib/api/client.ts` on `@mooshala/api-client` | Typed calls; every non-2xx becomes an `ApiError`. |
| External services | `lib/services.tsx` (`Services` = auth gateway, API client, error reporter) | Behind interfaces; real or fake chosen once in `lib/create-services.ts`. |
| 3D rendering | `src/three` | No i18n, no data fetching; the farm feature passes overlays and callbacks in. Loaded lazily (`next/dynamic`), so login pages never download three.js. |

## Startup and state

`app/layout.tsx` (server) loads fonts and the messages for the stored language, then `app/providers.tsx` mounts: TanStack Query, `ServicesProvider`, the MSW worker when fakes are on (children wait for it), session restore, the sound unlock, and the toast viewport. `/` (`EntryGate`) routes to `/language` (first visit), `/login` (signed out) or the role's home.

## Authentication contract

- `AuthGateway` (`features/auth/gateway.ts`): `requestOtp`, `verifyOtp`, `loginWithClassKey`, `restore`, `getAccessToken`, `signOut`.
- `SupabaseAuthGateway`: phone OTP through Supabase Auth (the tokens the backend verifies). Class key through `POST /auth/class-key` (assumed contract; see `backend-handoff.md`). Class-key sessions live in `sessionStorage` (shared computers).
- `FakeAuthGateway`: any valid number, code `123456` (`000000` = expired, `9999999999` = rate limited).
- After sign-in, `usePostSignIn` stores the session, loads `GET /me`, adopts the profile's language, and routes (safe same-site `?next=` only).

## User and role models

`features/auth/types.ts`: `Role = "student" | "teacher" | "parent"`, `LanguageMode = "hindi" | "kannada"`, `Profile` (mirrors the backend `MeResponse`), `Session`. One user can hold several roles; the last one used on this device opens first (`lastRole`).

## Navigation conventions

- Route groups: `(auth)` onboarding and login, `(student)` `/farm/...`, `(teacher)` `/teacher/...`, `(parent)` `/parent/...`. Each group layout wraps `RoleGate` (redirects signed-out users to `/login?next=...`, other roles to their home) and its shell. The backend enforces access too; the gate is UX.
- `features/shell/nav.ts` holds every shell destination with the phase that builds it. Items from later phases render disabled with "Coming soon"; a phase enables its items by building the route and raising `CURRENT_PHASE`.
- Student: full-viewport 3D farm, HUD on top (player chip, sound, menu), wooden dock at the bottom. No sidebar.
- Teacher: top bar (class switcher, sound, menu) and section tabs; content uses the full width.
- Parent: one column, phone first.

## API integration conventions

- Call the typed client from a TanStack Query hook: `unwrap(await api.GET("/path", {...}))`. Never `fetch` directly (the one exception is the not-yet-generated `/auth/class-key`).
- Errors are `ApiError { code, status, retryable }`. Show them with `<ErrorState error={...} onRetry={...}>`, which maps the code to a bilingual message. Queries retry network and 5xx twice, never 4xx.
- Every screen renders loading (`LoadingState`), empty (`EmptyState`), error (`ErrorState`) and success. No blank screens.
- New endpoint: export OpenAPI, `pnpm generate`, add an MSW handler in `src/mocks/handlers.ts` typed with `Schemas[...]`, add error codes to `lib/api/errors.ts` and the `errors` messages.

## Language rules

Messages exist in `en`, `hi` and `kn` (a test enforces identical keys). `useBilingual(namespace)(key)` returns `{ regional, english }`, rendered by `BilingualText` (bold regional line above the muted English line). The regional language comes from the stored language mode (cookie `mooshala_lang`, synced from the profile), never from the browser. New Hindi and Kannada strings go into `docs/translations-to-review.md` (a test checks this). Say "Not quite", never "Wrong".

## Design tokens and shared components

Tokens live in `packages/tokens/src/index.ts`: the web PRD brand colours (grass, sky, sun, flame, berry, coral, ink, cloud), the farm extensions (leaf, meadow, wood, soil, cream, parchment, stone), accessible "strong" shades for text on colour, radii (12 px buttons, 16 px cards, 20 px panels), the type scale, spacing, elevation (chunky lip, float shadows) and motion timings. `pnpm --filter @mooshala/tokens generate` writes `tokens.css` as a Tailwind `@theme` block, so `bg-grass-strong`, `rounded-card` and `text-lg` exist; tests check the CSS is in sync and that text pairs pass WCAG AA. The 3D world imports the same values.

Components (`src/components/ui`, all with stories): `ChunkyButton` (primary, white, ghost, sky, wood; loading; `asChild`), `BilingualText`, `TextField`, `AnswerOption`, `SpeechBubble`, `ProgressBar`, `TopStatsBar`, `StreakFlame`, `XPRing`, `HeartMeter`, `GemCounter`, `LeagueRow`, `QuestCard`, `BadgeTile`, `SourceChip`, `StickerIcon` (55 sticker icons extracted from the Aaroh prototype), `GoluMascot` (7 static poses from the prototype), `MeadowScene`, `Card`, `WoodPanel`, `Dialog` (Radix), `Toaster`/`toast` (Radix), `LoadingState`, `EmptyState`, `ErrorState`, `Spinner`. Motion presets (pop, shake, float, flicker, confetti, each with a reduced-motion fade) are in `lib/motion/presets.ts`; the sound manager (`lib/sound`) never plays before a user gesture and has a one-tap mute.

## 3D rendering

React Three Fiber 9 + drei 10 on three.js 0.187.

- `three/engine/SceneContainer.tsx`: the reusable scene host. It probes WebGL, runs the lifecycle state machine (`scene-status.ts`: checking, loading, ready, error, contextLost, unsupported), handles context loss and restore, retries by remounting the canvas, lowers the pixel ratio when `PerformanceMonitor` reports slow frames, and always renders an overlay for non-ready states. Scenes are children.
- `three/config/camera.ts` and `lighting.ts`: camera framing and orbit limits; hemisphere fill and one shadow-casting sun with tight shadow bounds.
- `three/engine/quality.ts`: low, medium and high tiers from device hints (4 GB school PCs and data saver get the low tier: no shadows, DPR 1, fewer props).
- `three/world`: `terrain-math.ts` (pure height and ground functions, shared by the mesh and by prop placement), `Terrain.tsx` (displaced, vertex-coloured heightfield with a path, tilled field and pond), `objects.tsx` (barn, windmill, instanced crop field, fences, trees, hay bales), `Interactable.tsx` (hover and tap with a springy scale), `FarmWorld.tsx` (composition plus `OrbitControls`; it also pulls the camera back on portrait screens).
- Interaction: R3F pointer events (mouse, touch, pen). Keyboard and screen-reader users get the same places as a hidden button list (`FarmView`), with an aria-live announcement.

### 3D asset conventions

- Binary glTF (`.glb`) in `apps/web/public/models/`, registered in `three/assets/registry.ts`. Nothing loads a model that isn't registered.
- Metres, Y up, origin at the base centre, front facing +Z. Low poly and flat shaded, using token colours. Aim for under 50 KB per prop. Name meshes meaningfully (they show up in tests).
- Each model declares a procedural fallback; `FarmModel` shows it while loading and if the file fails (a per-asset error boundary reports the failure and keeps the farm running).
- `pnpm --filter @mooshala/web models` regenerates the two proof-of-concept models (tree, hay bale) with three's GLTFExporter. Artist models replace these files with the same names.
- Geometry built in code is disposed on unmount; GLB scenes are cached by drei and cloned per instance.

## Environment configuration

`apps/web/.env.example` lists the public variables. Only `NEXT_PUBLIC_*` values reach the browser; no secrets live in the web app. `NEXT_PUBLIC_USE_FAKES` defaults to `true` (fake login and MSW backend); with it `false`, `lib/env.ts` refuses to start without the API and Supabase settings. Sentry starts only when `NEXT_PUBLIC_SENTRY_DSN` is set (no tracing, no PII).

## Testing

```
pnpm install
pnpm --filter @mooshala/tokens test          # token CSS in sync, WCAG contrast of text pairs
cd apps/web
pnpm lint && pnpm typecheck
pnpm test                                    # Vitest + Testing Library + MSW (jsdom)
pnpm build && pnpm e2e                       # Playwright, desktop and Pixel 7, axe on the auth pages
pnpm storybook                               # component workshop (pnpm storybook:build in CI)
```

- Unit and component tests sit next to the code (`*.test.ts(x)`). `src/test/render.tsx` gives `renderWithProviders` (messages in hi or kn, fake services, a fresh query client) and `signInAs`. `next/navigation` is mocked via `src/test/navigation.ts`.
- `src/test/stories.test.tsx` renders every story in Hindi and in Kannada and runs axe on it (jsdom can't measure contrast; the token test and the Playwright axe runs cover it).
- 3D: the lifecycle, quality and terrain logic are pure and unit-tested; `@react-three/test-renderer` builds the farm scene graph without WebGL and fires a tap; Playwright renders the real WebGL scene with SwiftShader, checks the canvas isn't blank, drags to orbit, and selects a place.
