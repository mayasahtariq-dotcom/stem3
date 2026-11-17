# P2 frontend phase plan (Aaroh Web)

Nov 17, 2026

This plan splits P2's share of Aaroh Web (every student, teacher and parent screen, the call console, the design system, animation, accessibility, offline support and the end-to-end tests) into the six phases of the web spec's delivery roadmap (section 11). The spec says to build the phases strictly in order, so P2's phases line up week for week with the backend's, and each phase ends only when all its tests pass.

## How P2's work fits the roadmap

| Phase | Weeks | P2 focus | Gate |
| --- | --- | --- | --- |
| 1 Foundation | 1 to 3 | App shell, design system, login screens, test setup | |
| 2 Student core | 4 to 8 | Path, lesson player, core game feedback, terms, doubts | Playable demo |
| 3 Teacher and parent | 9 to 13 | Upload, review, publish, dashboard, parent and consent screens | |
| 4 Full game layer | 14 to 17 | League, quests, badges, Golu Pot, mascot growth | |
| 5 Call mode | 18 to 23 | Add call-only student, teacher call console | Real call works in Hindi and Kannada |
| 6 Pilot | 24 to 28 | Offline and PWA, notifications UI, accessibility audit, full E2E | Pilot go or no-go |

## Rules that apply to every phase

- Every screen has loading, empty, error and success states, and its own component tests (Vitest and Testing Library).
- Every string exists in en, hi and kn, with the bold regional line above the muted English line. Hindi and Kannada strings are logged as drafts in docs/translations-to-review.md.
- The copy says "Not quite", never "Wrong". Icons are illustrated stickers, never emoji.
- No game logic in the UI. XP, streaks, hearts, leagues and mastery come from the server; the browser only shows them.
- Every screen works at 360, 768, 1024 and 1440 px, with 44 px touch targets and full keyboard use.
- The app runs on fakes (MSW and NEXT_PUBLIC_USE_FAKES=true), so no real keys are needed.
- At the end of each phase: tick docs/progress.md, write a demo note in docs/demos/, and log any change of plan in docs/decisions.md.

## Phase 1: Foundation (weeks 1 to 3)

**Build**

- apps/web on Next.js App Router with strict TypeScript, route groups (student), (teacher), (parent) and (auth).
- packages/tokens with the colour tokens (grass, sky, sun, flame, berry, coral, ink, cloud), radii and fonts as CSS variables, wired into Tailwind.
- Fonts through next/font: Rubik, Noto Sans Devanagari, Noto Sans Kannada. next-intl with en, hi and kn files; language follows the stored language mode, not the browser.
- Core components in Storybook on shadcn/ui and Radix: ChunkyButton, AnswerOption, SpeechBubble, ProgressBar, TopStatsBar, StreakFlame, XPRing, HeartMeter, GemCounter, LeagueRow, QuestCard, BadgeTile, GoluMascot (static first), MeadowScene, BilingualText, SourceChip, StickerIcon.
- Motion and sound base: shared Framer Motion presets (pop, shake, float, flicker, confetti) with a reduced-motion fallback to fades; a Howler sound manager that never plays before a user gesture and has a one-tap mute.
- Layout shells: student left rail that becomes a bottom tab bar under 768 px with a right panel on wide screens; teacher top bar with class switcher and tabs; parent single column.
- Auth screens: language choice, role choice, phone OTP, join a class by key, QR or link, and school-computer login by class key plus name.
- Data layer: TanStack Query on the generated OpenAPI client (packages/api-client), Zustand store skeleton, MSW handlers, Sentry.
- Testing in CI: Vitest, Playwright, @axe-core/playwright and Storybook build in GitHub Actions.

**Done when** every component has a Storybook story that passes axe, and a Playwright test logs in by OTP and by class key against the fakes.

**Needs from backend** the Phase 1 OpenAPI file with the /auth endpoints.

## Phase 2: Student core (weeks 4 to 8)

**Build**

- Home and learning path: units, locked, current (glowing) and done lessons, the Continue card, and the right panel with streak, daily goal ring and a quests preview.
- Lesson player (Zustand): multiple choice, true/false, match and fill-in; wrong answers return at the end; keys 1 to 4 pick, Enter checks, Space continues; every question can be read aloud.
- In-lesson feedback: correct pop, gentle shake on "Not quite", floating XP, combo flame x3, heart loss, sounds.
- Lesson complete screen: XP total, accuracy, combo summary, any badge, confetti.
- Daily goal picker (20, 50 or 100 XP), streak flame, hearts with refill time, gem counter.
- Term cards, glossary, saved terms and the Listen button (Hindi and Kannada speech).
- Doubt chat that shows a SourceChip for the exact notes page.
- Realtime XP pops over WSS /realtime, with optimistic display that the server confirms.

**Done when (gate: playable demo)** a Playwright test goes from first login through a full lesson to the celebration screen in Hindi and in Kannada, on a phone and a desktop size.

**Needs from backend** /home, /courses/{id}/path, /lessons, /attempts, /game/stats, /doubts, /audio and the realtime channel.

## Phase 3: Teacher and parent (weeks 9 to 13)

**Build**

- Teacher shell with class switcher and the Overview, Students, Courses and Calls tabs (Calls stays a placeholder until Phase 5).
- Upload: drag and drop many photos or PDFs, per-file progress, and an outline plus first lesson within 60 seconds.
- Review screen: flagged (low-confidence) questions first; edit, regenerate, delete; publish to a class.
- Class dashboard with Recharts: weak topics, idle students, a call-only students list and the league on/off switch.
- Parent: link to a child by code, weekly summary, listen to the summary, switch children.
- Consent: consent screen, revoke consent, request deletion; and a consent gate that stops a student before their first lesson.

**Done when** E2E tests cover teacher upload to publish to a student seeing the lesson, and parent link to consent to summary.

**Needs from backend** /uploads, /courses/{id}, /questions/{id}, /publish, /dashboard and the /parent endpoints.

## Phase 4: Full game layer (weeks 14 to 17)

**Build**

- League screen: pods of 10, five tiers, promotion and demotion zones, own row shown first, first names or nicknames only, opt-out, and a phone icon for call-only students.
- Quests screen: three daily quests, one weekly quest and the twin's revision quest with double gems.
- Badges and profile with a trophy shelf.
- Golu Pot opening animation, gem spending on streak freezes, hearts and outfits.
- Mascot growth from calf to cow to champion (Lottie) with outfits and scenes.
- Healthy-play UI: Golu's break suggestion after about 45 minutes, quiet hours, and no loss-shaming copy.

**Done when** E2E tests cover finishing a lesson, opening a pot, completing a quest and seeing the league update, plus the league-off state a teacher sets.

**Needs from backend** /game/quests, /game/league, /game/pots, /game/freeze, /game/badges.

## Phase 5: Call mode (weeks 18 to 23)

**Build**

- "Add student without phone app" form (react-hook-form and zod): name, phone in E.164, language, call days, call window kept inside 9 am to 9 pm IST, optional parent phone.
- Status chips: Waiting for consent, Active, Not reachable; the phone icon in student lists, league and dashboard.
- Teacher call console: live status per student (next call, last call, answered and missed, minutes against the cap, consent), Pause calls, Call now (disabled outside allowed hours), edit window, and the per-class cost and minutes report.
- Twin card per student: weak concepts and the lesson the next call will use.

**Done when** E2E tests run the whole console against the fake telephony provider; the gate itself (a real call in Hindi and Kannada) is shared with the backend.

**Needs from backend** the /call-students endpoints and status updates.

## Phase 6: Pilot (weeks 24 to 28)

**Build**

- Offline and install: Serwist service worker and web app manifest, cache of the current lesson and path, offline answer queue that syncs when back online, install prompt.
- Fast student switching on shared school computers.
- Notifications UI: web push opt-in, in-app inbox, quiet hours and daily cap settings.
- Accessibility audit to WCAG 2.2 AA: contrast, focus rings, keyboard play, screen reader labels in both languages, no meaning by colour alone.
- Performance: first lesson under 3 seconds on slow 4G, checked on a 4 GB PC profile.
- Full E2E regression across student, teacher and parent at all four breakpoints and all three languages.

**Done when (gate: pilot go or no-go)** the full suite is green, the axe audit has no serious issues, and the 3-second budget is met.

## Open questions

- The feature table lists Golu Pot and the mascot as P0 (first release) but the roadmap puts them in Phase 4. This plan follows the roadmap and shows only a static Golu before Phase 4.
- Term cards and doubt chat are P0 but not named in the roadmap; this plan puts them in Phase 2.
- Who owns the OpenAPI contract each phase, so the frontend can build on fakes ahead of the real endpoints?
