# Web Phase 1 demo: foundation, login and the 3D farm

Run it (fakes on, no keys needed):

```
pnpm install
pnpm --filter @mooshala/web dev      # http://localhost:3000
```

1. Open `/`. You land on **Choose your language**. Tap **ಕನ್ನಡ + English**: the next screens show Kannada above English.
2. Tap **Student**. On the phone screen type `12345` and tap **Send code**: the red bilingual error appears. Type `9876543210` → **Send code** → a toast and the code screen with a 30-second resend timer.
3. Type `111111` → **Verify**: "Not quite. Check the code and try again." Type `123456` → **Verify**.
4. You're on the **3D farm** (Asha's profile is Hindi, so the app switches to Hindi; the profile's stored language wins). Drag to turn, scroll or pinch to zoom. Tap the barn, windmill, field or pond: a wooden card names it. Press Tab to reach the same places from the keyboard. The bottom dock shows Learn, Quests, League and Profile as "coming soon".
5. Tap the menu (top right) → **Sign out**. Tap **On a school computer? Use a class key** → key `bi09k4x2` (it formats itself to `BI09-K4X2`), name `Ravi` → **Sign in** → farm. Try `BI09-XPRD` for the expired-key message.
6. Sign out, sign in with `9876500001`: the **teacher shell** with the class switcher and tabs. Visiting `/farm` sends you back to `/teacher`. Sign in with `9876500002` for the **parent shell**.
7. New user: sign in with `9123456780` → **What should we call you?** → name → **Join your class** → `CH10-KNDA` → preview → **Join this class** → farm. `/join/BI09-K4X2` opens with the key filled in.
8. `pnpm --filter @mooshala/web storybook` shows every component; switch Hindi/Kannada in the toolbar and open the Accessibility panel.
