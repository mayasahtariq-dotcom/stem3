# Web Phase 3 demo: teacher portal and parent mode

Run with the fakes: `pnpm --filter @mooshala/web dev`, open http://localhost:3000. Code for every phone: `123456`. Use **Reset demo data** in the menu to start fresh.

1. **Teacher dashboard.** Choose Teacher, phone `9876500001`. The overview shows active students, class accuracy, who needs help (Dev first: overdue and low accuracy), weak topics and the class key.
2. **A student.** Students → Needs help → **Dev**: lesson results, weakest concepts, "often mixed up".
3. **Review AI questions.** Courses → **Tissues** → lesson 1 **Review**. Two questions are flagged and Publish is locked. Tap **Looks right** on one, **Edit** the other (change the answer) and **Save**.
4. **Publish.** Publish unlocks; tap it. "This lesson is live". Back on the course it shows Published and assigned to 9-A.
5. **Upload notes.** Courses → **New course from notes**. Add a JPG, a 14 MB PDF (marked "too large", remove it) and typed notes → **Make the course**. Watch page progress, then the AI steps, then **Review the first lesson**.
6. **School consent.** Overview → **Turn off** school consent. Sign out.
7. **Parent links a child.** Choose Parent, phone `9876500002`. Type `EXP1RD` ("expired"), then `K7M4PX`: "Is this your child, Asha?" → **Yes, link**.
8. **Consent and summary.** Tap **I approve**. Read the weekly summary (tap **Listen**), support areas, milestones, assignments and the farm picture. **Pause learning** then signs Asha's lessons out until approved again; **Delete my child's data** asks first and shows the date it completes by.

Student side: Profile → **Make a code** shows a six-letter code and the linked parents.
