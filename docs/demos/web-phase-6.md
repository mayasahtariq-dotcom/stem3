# Web Phase 6 demo (offline and desktop layout)

Run: `npx pnpm@10.28.0 --filter @mooshala/web dev`, then open http://localhost:3000 (fake backend, no keys needed).

1. **Desktop layout.** On a laptop, sign in as the student (Hindi, Student, 9876543210, code 123456). The top bar shows Aaroh, the links Farm / Learn / Quests / League / Profile and the stats. There's no bottom dock. Narrow the window below 1024 px and the game dock comes back.
2. **Offline answers.** Open the Learning barn and start "Parts of a cell". In Chrome DevTools, go to Network and set it to Offline.
   - A banner says you're offline.
   - Answer a question and you'll see "Saved on this phone", with no grade.
3. **Sync once.** Set Network back to No throttling.
   - The banner says it's sending, then disappears.
   - The XP in the top bar rises once.
   - Reloading or reconnecting again never adds it twice.
4. **Finish offline.** Go offline and play to the end. The finish screen says your rewards arrive when you're back online. Reconnect, and the lesson shows as done on the path.
