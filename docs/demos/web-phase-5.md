# Web Phase 5 demo: call mode (teacher)

Run with the fakes: `pnpm --filter @mooshala/web dev`, open http://localhost:3000. Code for every phone: `123456`. Use **Reset demo data** in the menu to start fresh.

The backend has no call-student endpoints yet, so everything here comes from the fake server (`apps/web/src/mocks/calls`). With real services the Calls page shows its error state.

1. **Open Calls.** Choose Teacher, phone `9876500001`, then go to `/teacher/calls`. Class 9-A has four students without the app:
   - **Lakshmi** is scheduled and has used 4 of 15 minutes this week.
   - **Raju** is waiting for consent.
   - **Meera** is not reachable after three unanswered tries.
   - **Sunil** has hit the 15-minute weekly cap.
2. **Locked reasons.** Select Raju, Meera or Sunil. "Call now" is disabled, and the panel says why (consent pending, not reachable, or weekly cap reached).
3. **Calling hours.** Select Lakshmi and tap **Call now** outside her 5 to 7 pm IST window. The server refuses with OUTSIDE_CALL_HOURS and the panel shows that message. To try a call at any hour, tap **Pretend it's 6 pm** on the demo card (fake mode only). **Real time** puts the clock back.
4. **Call now.** With the demo clock at 6 pm, tap **Call now** on Lakshmi. The panel goes Dialing, then Ringing, then Connected, but only after the server says so (it polls every second). A second tap does nothing while the call is live. After about 15 seconds the call completes, and her minutes go to 6 of 15.
5. **Pause.** Tap **Pause calls** on Lakshmi: her status becomes Paused and Call now locks. Tap **Resume calls** to undo it.
6. **No answer and retry.** In the fake, a phone ending in `0` never answers. Add a student whose phone ends in `0`, wait a minute for consent, then call them. The panel shows "Nobody answered. Trying again at …" (20 minutes later). The fake retries twice, 20 minutes apart, then marks the student "Not reachable".
7. **Add a student without the app.** Tap **Add student without app**:
   - Tap **Next** with the form empty to see the name and phone messages.
   - Type name `Kiran`, phone `9845011111`, then **Next** and **Save**. You get "already in this class" (DUPLICATE_PHONE).
   - Change the phone to `9845055555`, then **Next**. Check the confirmation (+919845055555, 5:00 pm to 7:00 pm, Mon to Sat) and tap **Save**.
   - Kiran appears as "Waiting for consent". In the fake, consent arrives one minute later.
8. **The window rules.** Try a window of 8:30 pm to 9:30 pm, end before start, or under 30 minutes. Each one shows its own message. Sunday can't be picked.
