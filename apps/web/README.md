# Mooshala Web

Next.js app for students (3D farm), teachers and parents. Architecture and conventions: `docs/web/architecture.md`. Backend contract notes: `docs/web/backend-handoff.md`.

```
pnpm install                       # from the repository root (Node 22, pnpm 10)
pnpm --filter @mooshala/web dev    # http://localhost:3000, fakes on: any 10-digit number, code 123456
```

Demo numbers (fakes): student `9876543210`, teacher `9876500001`, parent `9876500002`, any other number is a new user. Class keys: `BI09-K4X2` (valid), `BI09-XPRD` (expired), `CH10-KNDA` (Kannada only), `PH08-MANY` (rate limited).

Real services: copy `.env.example` to `.env.local`, set `NEXT_PUBLIC_USE_FAKES=false` and fill in the API and Supabase values.
