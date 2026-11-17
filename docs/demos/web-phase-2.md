# Web Phase 2 demo: the student's farm and lessons

Run it with the fakes (no keys): `pnpm --filter @mooshala/web dev` and open http://localhost:3000. Sign in as the student: phone `9876543210`, code `123456`. If you played before, open the menu (top right) and tap **Reset demo data**.

1. **Enter the farm.** The HUD shows a 3-day streak, 4 of 5 hearts, 140 gems and today's XP ring. Golu greets Asha.
2. **Explore.** Drag to turn, pinch or scroll to zoom. Cows blink, swish their tails and graze in the pasture; ducks paddle; butterflies circle the flowers; the stream flows; clouds drift.
3. **Pick a destination.** Tap the **signboard** for course progress (1 of 6 lessons) and chapters. Tap a grey **stone** on the path: "Finish "Parts of a cell" first".
4. **Open a lesson.** Tap the red **learning barn** (or the glowing post) → **Start lesson**.
5. **Answer wrong.** On "Which part controls the cell?" choose **Mitochondria** → **Check**: "Not quite", the plant bends and springs back, Golu thinks, one heart goes, the explanation shows and "We'll come back to this one at the end". **Ask Golu why** opens the doubt chat about this question.
6. **Answer right.** A sprout grows and a flower blooms, "+10 XP" floats up (the server's number).
7. **Match pairs.** Tap a part, then its job. A mixed-up pair shakes and costs no heart.
8. **Interrupt.** Reload the page mid-lesson: it resumes at the same question.
9. **Finish.** The basket fills, with XP earned, accuracy and the streak (now 4: "Your streak grew today!"). **Back to the farm**: a new flower has bloomed on the path, the crops are taller, gems went up by 5.
10. **Spend gems.** Tap the **market stall** → buy the **Sunflower patch** or a streak freeze. Bought decorations appear on the farm. Lessons never cost gems.
11. **Terms.** Tap the **farmhouse** → **Open the word book**. Search `ribo` or `केंद्रक`; open a word for its meaning and farm analogy; **Save word**; filter **Saved**.
12. **Doubt.** Tap the **farm lab** or **Golu** → type "What does the nucleus do?" → the answer cites "From your notes, page 2"; try **Explain it simpler** and **Give an example**. Type a message containing "fail" to see the "Golu can't answer right now" state.

Other states: lesson 6 ("Cell review") is still being generated and says so. Hearts at zero pause the lesson with the refill time.
